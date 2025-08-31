package main

import (
	"archive/zip"
	"bytes"
	"fmt"
	"go/parser"
	"go/token"
	"io"
	"io/fs"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"github.com/dave/dst"
	"github.com/dave/dst/decorator"
	"github.com/dave/dst/dstutil"
	"github.com/gin-gonic/gin"
)

func hasMultipleGroups(crds []CRD) bool {
	if len(crds) <= 1 {
		return false
	}

	firstGroup := crds[0].Group
	for _, crd := range crds[1:] {
		if crd.Group != firstGroup {
			return true
		}
	}
	return false
}

func runOperatorSDK(c *gin.Context) {
	log.Printf("Received POST request to /v1/run")

	var request OperatorData
	if err := c.ShouldBindJSON(&request); err != nil {
		log.Printf("Error parsing request payload: %v", err)
		c.JSON(400, gin.H{"error": "Invalid request payload", "details": err.Error()})
		return
	}

	log.Printf("Request parsed successfully: Domain=%s, Repo=%s, ProjectName=%s, CRDs=%d",
		request.Domain, request.Repo, request.ProjectName, len(request.CRDs))

	needsMultiGroup := hasMultipleGroups(request.CRDs)
	log.Printf("Multi-group layout needed: %v", needsMultiGroup)

	// build in /tmp
	tmpDir, err := os.MkdirTemp("/tmp", "sdk-")
	if err != nil {
		log.Printf("Error creating temporary directory: %v", err)
		c.JSON(500, gin.H{"error": "Failed to create temporary directory", "details": err.Error()})
		return
	}
	log.Printf("Created temporary directory: %s", tmpDir)

	// setup a writable Go environment inside a subdir of the temp dir
	cachesRoot := filepath.Join(tmpDir, ".osdk_cache")
	goCacheDir := filepath.Join(cachesRoot, "gocache")
	goModCache := filepath.Join(cachesRoot, "pkg", "mod")
	goPath := filepath.Join(cachesRoot, "gopath")
	if err := os.MkdirAll(goCacheDir, 0o700); err != nil {
		log.Printf("Warning: failed to create go cache dir %s: %v", goCacheDir, err)
	}
	if err := os.MkdirAll(goModCache, 0o700); err != nil {
		log.Printf("Warning: failed to create go mod cache %s: %v", goModCache, err)
	}
	if err := os.MkdirAll(goPath, 0o700); err != nil {
		log.Printf("Warning: failed to create GOPATH dir %s: %v", goPath, err)
	}
	log.Printf("Go env caches created under: %s", cachesRoot)

	cmdEnv := append(os.Environ(),
		"GOCACHE="+goCacheDir,
		"GOMODCACHE="+goModCache,
		"GOPATH="+goPath,
		"HOME="+tmpDir,
	)

	log.Printf("Running operator-sdk init with domain=%s, repo=%s", request.Domain, request.Repo)
	initArgs := []string{"init", "--domain", request.Domain, "--repo", request.Repo}
	initCmd := exec.Command("operator-sdk", initArgs...)
	initCmd.Dir = tmpDir

	output, err := initCmd.CombinedOutput()
	if err != nil {
		log.Printf("operator-sdk init failed: %v, output: %s", err, string(output))
		c.JSON(500, gin.H{"error": "operator-sdk init failed", "details": string(output)})
		return
	}
	log.Printf("operator-sdk init completed successfully")

	// Enable multigroup layout if needed
	if needsMultiGroup {
		log.Printf("Enabling multigroup layout")
		editCmd := exec.Command("operator-sdk", "edit", "--multigroup=true")
		editCmd.Dir = tmpDir
		editCmd.Env = cmdEnv
		editOutput, editErr := editCmd.CombinedOutput()
		if editErr != nil {
			log.Printf("operator-sdk edit --multigroup=true failed: %v, output: %s", editErr, string(editOutput))
			c.JSON(500, gin.H{"error": "Failed to enable multigroup layout", "details": string(editOutput)})
			return
		}
		log.Printf("Multigroup layout enabled successfully")
	}

	tidyCmd := exec.Command("go", "mod", "tidy")
	tidyCmd.Dir = tmpDir
	tidyCmd.Env = cmdEnv
	tidyOut, tidyErr := tidyCmd.CombinedOutput()
	if tidyErr != nil {
		log.Printf("Warning: go mod tidy failed: %v, output: %s", tidyErr, string(tidyOut))
	} else {
		log.Printf("Ran go mod tidy successfully")
	}
	log.Printf("Go modules prepared successfully")

	// Run operator-sdk create api for each CRD
	log.Printf("Creating APIs for %d CRDs", len(request.CRDs))
	for i, crd := range request.CRDs {
		log.Printf("Creating API %d/%d: Group=%s, Version=%s, Kind=%s, Controller=%t",
			i+1, len(request.CRDs), crd.Group, crd.Version, crd.Kind, crd.Controller)
		args := []string{"create", "api", "--resource", "--group", crd.Group, "--version", crd.Version, "--kind", crd.Kind, "--make=false"}
		if crd.Controller {
			args = append(args, "--controller")
		} else {
			args = append(args, "--controller=false")
		}
		apiCmd := exec.Command("operator-sdk", args...)
		apiCmd.Dir = tmpDir
		apiCmd.Env = cmdEnv
		output, err := apiCmd.CombinedOutput()
		if err != nil {
			log.Printf("operator-sdk create api failed for %s: %s\n%s", crd.Kind, err, output)
			c.JSON(500, gin.H{"error": "operator-sdk create api failed for " + crd.Kind, "details": string(output)})
			return
		}
		log.Printf("API created successfully for %s", crd.Kind)
	}

	// Update Go type files with properties
	log.Printf("Updating Go type files with properties")
	if err := UpdateGoTypesDST(tmpDir, request.CRDs); err != nil {
		log.Printf("Error updating Go type files: %v", err)
		c.JSON(500, gin.H{"error": "Failed to update Go type files", "details": err.Error()})
		return
	}
	log.Printf("Go type files updated successfully")

	// Add RBAC markers to controller files
	log.Printf("Adding RBAC markers to controller files")
	if err := UpdateControllerRBAC(tmpDir, request.CRDs); err != nil {
		log.Printf("Error updating controller RBAC: %v", err)
		c.JSON(500, gin.H{"error": "Failed to update controller RBAC", "details": err.Error()})
		return
	}
	log.Printf("Controller RBAC markers added successfully")

	// Create webhooks for CRDs that have webhook configurations
	log.Printf("Creating webhooks for CRDs")
	if err := CreateWebhooks(tmpDir, request.CRDs); err != nil {
		log.Printf("Error creating webhooks: %v", err)
		c.JSON(500, gin.H{"error": "Failed to create webhooks", "details": err.Error()})
		return
	}
	log.Printf("Webhooks created successfully")

	// Patch the generated main.go to set namespace scope
	log.Printf("Patching main.go for namespace scope")
	if err := PatchMainNamespaceScopeDST(tmpDir, []string{"default"}); err != nil {
		log.Printf("Error patching main.go: %v", err)
		c.JSON(500, gin.H{"error": "Failed to patch main.go for namespace scope", "details": err.Error()})
		return
	}
	log.Printf("main.go patched successfully")

	// Write the output to a zip file
	log.Println("Creating zip file...")
	zipFilePath := filepath.Join(tmpDir, "output.zip")
	zipFile, err := os.Create(zipFilePath)
	if err != nil {
		log.Printf("Error creating zip file: %v", err)
		c.JSON(500, gin.H{"error": "Failed to create zip file", "details": err.Error()})
		return
	}
	defer zipFile.Close()

	if err := zipDir(tmpDir, zipFile); err != nil {
		log.Printf("Error writing to zip file: %v", err)
		c.JSON(500, gin.H{"error": "Failed to write to zip file", "details": err.Error()})
		return
	}
	log.Println("Zip file created successfully.")

	// Serve the zip file
	log.Printf("Serving zip file: %s", zipFilePath)
	c.File(zipFilePath)
	log.Printf("Zip file served successfully")

	// Gracefully shut down the container after serving the file
	log.Println("Shutting down the container...")
	go func() {
		os.Exit(0)
	}()
}

func zipDir(srcDir string, w io.Writer) error {
	log.Printf("Starting to zip directory: %s", srcDir)
	zipWriter := zip.NewWriter(w)
	defer func() {
		log.Println("Closing zip writer")
		zipWriter.Close()
	}()

	err := filepath.WalkDir(srcDir, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			log.Printf("Error accessing path %s: %v", path, err)
			return err
		}
		log.Printf("Processing path: %s", path)

		// Skip the output.zip file
		if filepath.Base(path) == "output.zip" {
			log.Printf("Skipping file: %s", path)
			return nil
		}

		if d.IsDir() {
			log.Printf("Skipping directory: %s", path)
			return nil
		}
		relPath, err := filepath.Rel(srcDir, path)
		if err != nil {
			log.Printf("Error getting relative path for %s: %v", path, err)
			return err
		}
		log.Printf("Relative path: %s", relPath)
		f, err := zipWriter.Create(relPath)
		if err != nil {
			log.Printf("Error creating zip entry for %s: %v", relPath, err)
			return err
		}
		srcFile, err := os.Open(path)
		if err != nil {
			log.Printf("Error opening file %s: %v", path, err)
			return err
		}
		defer srcFile.Close()
		_, err = io.Copy(f, srcFile)
		if err != nil {
			log.Printf("Error copying file %s to zip: %v", path, err)
			return err
		}
		log.Printf("Successfully added %s to zip", path)
		return nil
	})
	if err != nil {
		log.Printf("Error walking directory %s: %v", srcDir, err)
		return err
	}
	log.Println("Finished zipping directory")
	return nil
}

// UpdateGoTypesDST parses the generated *_types.go file with dave/dst,
// finds the <Kind>Spec struct, then replaces the entire field list with
// fields derived from the CRD.Properties slice.
func UpdateGoTypesDST(projectDir string, crds []CRD) error {
	needsMultiGroup := hasMultipleGroups(crds)
	log.Printf("UpdateGoTypesDST: needsMultiGroup=%v", needsMultiGroup)

	for _, crd := range crds {
		var apiDir string
		if needsMultiGroup {
			// Multi-group layout: api/<group>/<version>/
			apiDir = filepath.Join(projectDir, "api", crd.Group, crd.Version)
		} else {
			// Single-group layout: api/<version>/
			apiDir = filepath.Join(projectDir, "api", crd.Version)
		}
		goFile := filepath.Join(apiDir, strings.ToLower(crd.Kind)+"_types.go")
		log.Printf("UpdateGoTypesDST: Processing CRD %s.%s/%s, file path: %s", crd.Kind, crd.Group, crd.Version, goFile)

		fset := token.NewFileSet()
		file, err := decorator.ParseFile(fset, goFile, nil, parser.ParseComments)
		if err != nil {
			return fmt.Errorf("parse %s: %w", goFile, err)
		}

		// No enum type/const generation; only kubebuilder markers

		dstutil.Apply(file, func(c *dstutil.Cursor) bool {
			ts, ok := c.Node().(*dst.TypeSpec)
			if !ok {
				return true
			}

			// Handle the main Kind struct for CRD-level markers
			if ts.Name.Name == crd.Kind {
				if crd.Status {
					// Add status subresource marker to the Kind struct
					statusMarker := "// +kubebuilder:subresource:status"
					ts.Decs.Start.Append(statusMarker)
					log.Printf("Added status subresource marker to %s", crd.Kind)
				}
				return true
			}

			// Handle the KindSpec struct for property validation markers
			if ts.Name.Name != crd.Kind+"Spec" {
				return true
			}
			st, ok := ts.Type.(*dst.StructType)
			if !ok {
				return true
			}
			var fields []*dst.Field
			for _, p := range crd.Properties {
				goType := dst.NewIdent(GoTypeForProperty(p.Type))
				markers := buildKubebuilderMarkers(p)
				tags := fmt.Sprintf("json:\"%s,omitempty\"", p.Name)
				field := &dst.Field{
					Names: []*dst.Ident{dst.NewIdent(ToCamelCase(p.Name))},
					Type:  goType,
					Tag: &dst.BasicLit{
						Kind:  token.STRING,
						Value: fmt.Sprintf("`%s`", tags),
					},
				}
				if len(markers) > 0 {
					field.Decs.Start.Append(markers...)
				}
				fields = append(fields, field)
			}
			st.Fields.List = fields
			return false
		}, nil)
		var buf bytes.Buffer
		if err := decorator.Fprint(&buf, file); err != nil {
			return fmt.Errorf("print %s: %w", goFile, err)
		}
		if err := os.WriteFile(goFile, buf.Bytes(), 0o644); err != nil {
			return fmt.Errorf("write %s: %w", goFile, err)
		}
		log.Printf("Updated Go type file (dst): %s", goFile)
	}
	return nil
}

// PatchMainNamespaceScopeDST updates the generated cmd/main.go to set namespace scope using dave/dst
func PatchMainNamespaceScopeDST(projectDir string, namespaces []string) error {
	mainPath := filepath.Join(projectDir, "cmd", "main.go")
	fset := token.NewFileSet()
	fileAst, err := decorator.ParseFile(fset, mainPath, nil, parser.ParseComments)
	if err != nil {
		return fmt.Errorf("parse main.go: %w", err)
	}
	found := false
	dstutil.Apply(fileAst, func(c *dstutil.Cursor) bool {
		cl, ok := c.Node().(*dst.CallExpr)
		if !ok {
			return true
		}
		// Look for ctrl.NewManager call
		if sel, ok := cl.Fun.(*dst.SelectorExpr); ok && sel.Sel.Name == "NewManager" {
			if len(cl.Args) == 2 {
				if opts, ok := cl.Args[1].(*dst.CompositeLit); ok {
					found = true
					cacheFieldIdx := -1
					for i, elt := range opts.Elts {
						if kv, ok := elt.(*dst.KeyValueExpr); ok {
							if ident, ok := kv.Key.(*dst.Ident); ok && ident.Name == "Cache" {
								cacheFieldIdx = i
								break
							}
						}
					}
					if len(namespaces) == 0 {
						// Remove Cache field if present (cluster-scoped)
						if cacheFieldIdx >= 0 {
							opts.Elts = append(opts.Elts[:cacheFieldIdx], opts.Elts[cacheFieldIdx+1:]...)
						}
					} else {
						// Set Cache.DefaultNamespaces to provided list
						mapElts := []dst.Expr{}
						for _, ns := range namespaces {
							mapElts = append(mapElts, &dst.KeyValueExpr{
								Key:   &dst.BasicLit{Kind: token.STRING, Value: fmt.Sprintf("\"%s\"", ns)},
								Value: &dst.CompositeLit{Type: &dst.SelectorExpr{X: dst.NewIdent("cache"), Sel: dst.NewIdent("Config")}},
							})
						}
						cacheConfig := &dst.KeyValueExpr{
							Key: dst.NewIdent("Cache"),
							Value: &dst.CompositeLit{
								Type: &dst.SelectorExpr{
									X:   dst.NewIdent("cache"),
									Sel: dst.NewIdent("Options"),
								},
								Elts: []dst.Expr{
									&dst.KeyValueExpr{
										Key: dst.NewIdent("DefaultNamespaces"),
										Value: &dst.CompositeLit{
											Type: &dst.MapType{
												Key:   dst.NewIdent("string"),
												Value: &dst.SelectorExpr{X: dst.NewIdent("cache"), Sel: dst.NewIdent("Config")},
											},
											Elts: mapElts,
										},
									},
								},
							},
						}
						if cacheFieldIdx >= 0 {
							opts.Elts[cacheFieldIdx] = cacheConfig
						} else {
							opts.Elts = append(opts.Elts, cacheConfig)
						}
					}
				}
			}
		}
		return true
	}, nil)

	// Ensure the import for 'sigs.k8s.io/controller-runtime/pkg/cache' exists in the existing import group
	foundImport := false
	dstutil.Apply(fileAst, func(c *dstutil.Cursor) bool {
		genDecl, ok := c.Node().(*dst.GenDecl)
		if !ok || genDecl.Tok != token.IMPORT {
			return true
		}
		for _, spec := range genDecl.Specs {
			importSpec, ok := spec.(*dst.ImportSpec)
			if !ok {
				continue
			}
			if importSpec.Path.Value == "\"sigs.k8s.io/controller-runtime/pkg/cache\"" {
				foundImport = true
				break
			}
		}
		if !foundImport {
			genDecl.Specs = append(genDecl.Specs, &dst.ImportSpec{
				Path: &dst.BasicLit{
					Kind:  token.STRING,
					Value: "\"sigs.k8s.io/controller-runtime/pkg/cache\"",
				},
			})
			foundImport = true
		}
		return false
	}, nil)

	if !foundImport {
		// If no import group exists, create a new one
		fileAst.Decls = append([]dst.Decl{
			&dst.GenDecl{
				Tok: token.IMPORT,
				Specs: []dst.Spec{
					&dst.ImportSpec{
						Path: &dst.BasicLit{
							Kind:  token.STRING,
							Value: "\"sigs.k8s.io/controller-runtime/pkg/cache\"",
						},
					},
				},
			},
		}, fileAst.Decls...)
	}

	if found {
		var buf bytes.Buffer
		if err := decorator.Fprint(&buf, fileAst); err != nil {
			return fmt.Errorf("print main.go: %w", err)
		}
		if err := os.WriteFile(mainPath, buf.Bytes(), 0644); err != nil {
			return fmt.Errorf("write main.go: %w", err)
		}
		log.Printf("Patched main.go for namespace scope (dst): %s", mainPath)
	}
	return nil
}

// buildKubebuilderMarkers builds Kubebuilder CRD validation markers for a property
func buildKubebuilderMarkers(p Property) []string {
	var markers []string
	for _, v := range p.Validations {
		switch v.Type {
		case "minLength":
			if s, ok := v.Value.(string); ok && s != "" {
				markers = append(markers, "+kubebuilder:validation:MinLength="+s)
			}
		case "maxLength":
			if s, ok := v.Value.(string); ok && s != "" {
				markers = append(markers, "+kubebuilder:validation:MaxLength="+s)
			}
		case "pattern":
			if s, ok := v.Value.(string); ok && s != "" {
				markers = append(markers, "+kubebuilder:validation:Pattern="+s)
			}
		case "minimum":
			if s, ok := v.Value.(string); ok && s != "" {
				markers = append(markers, "+kubebuilder:validation:Minimum="+s)
			}
		case "maximum":
			if s, ok := v.Value.(string); ok && s != "" {
				markers = append(markers, "+kubebuilder:validation:Maximum="+s)
			}
		case "multipleOf":
			if s, ok := v.Value.(string); ok && s != "" {
				markers = append(markers, "+kubebuilder:validation:MultipleOf="+s)
			}
		case "uniqueItems":
			if b, ok := v.Value.(bool); ok && b {
				markers = append(markers, "+kubebuilder:validation:UniqueItems=true")
			}
		case "minItems":
			if s, ok := v.Value.(string); ok && s != "" {
				markers = append(markers, "+kubebuilder:validation:MinItems="+s)
			}
		case "maxItems":
			if s, ok := v.Value.(string); ok && s != "" {
				markers = append(markers, "+kubebuilder:validation:MaxItems="+s)
			}
		case "minProperties":
			if s, ok := v.Value.(string); ok && s != "" {
				markers = append(markers, "+kubebuilder:validation:MinProperties="+s)
			}
		case "maxProperties":
			if s, ok := v.Value.(string); ok && s != "" {
				markers = append(markers, "+kubebuilder:validation:MaxProperties="+s)
			}
		case "format":
			if s, ok := v.Value.(string); ok && s != "" {
				markers = append(markers, "+kubebuilder:validation:Format="+s)
			}
		case "enum":
			if vals, ok := v.Value.([]interface{}); ok && len(vals) > 0 {
				var parts []string
				for _, val := range vals {
					if s, ok := val.(string); ok {
						parts = append(parts, s)
					}
				}
				if len(parts) > 0 {
					markers = append(markers, "+kubebuilder:validation:Enum="+strings.Join(parts, ","))
				}
			} else if vals, ok := v.Value.([]string); ok && len(vals) > 0 {
				markers = append(markers, "+kubebuilder:validation:Enum="+strings.Join(vals, ","))
			}
		case "required":
			markers = append(markers, "+kubebuilder:validation:Required")
		case "optional":
			markers = append(markers, "+kubebuilder:validation:Optional")
		case "default":
			if s, ok := v.Value.(string); ok && s != "" {
				markers = append(markers, "+kubebuilder:default:="+s)
			}
		case "example":
			if s, ok := v.Value.(string); ok && s != "" {
				markers = append(markers, "+kubebuilder:example:="+s)
			}
		case "type":
			if s, ok := v.Value.(string); ok && s != "" {
				markers = append(markers, "+kubebuilder:validation:Type="+s)
			}
		}
	}
	for i, m := range markers {
		markers[i] = "// " + m
	}
	return markers
}

func GoTypeForProperty(openapiType string) string {
	switch openapiType {
	case "string":
		return "string"
	case "integer":
		return "int"
	case "number":
		return "float64"
	case "boolean":
		return "bool"
	case "array":
		return "[]interface{}" // Could be improved with more info
	case "object":
		return "map[string]interface{}"
	default:
		return "interface{}"
	}
}

// ToCamelCase converts snake_case or kebab-case to CamelCase
func ToCamelCase(s string) string {
	parts := strings.FieldsFunc(s, func(r rune) bool {
		return r == '_' || r == '-'
	})
	for i, part := range parts {
		if len(part) > 0 {
			parts[i] = strings.ToUpper(part[:1]) + part[1:]
		}
	}
	return strings.Join(parts, "")
}

// UpdateControllerRBAC adds RBAC markers to controller files based on user selections
func UpdateControllerRBAC(projectDir string, crds []CRD) error {
	needsMultiGroup := hasMultipleGroups(crds)
	log.Printf("UpdateControllerRBAC: needsMultiGroup=%v", needsMultiGroup)

	for _, crd := range crds {
		if !crd.Controller {
			continue // Skip if no controller requested
		}

		var controllerDir string
		if needsMultiGroup {
			// Multi-group layout: internal/controller/<group>/
			controllerDir = filepath.Join(projectDir, "internal", "controller", crd.Group)
		} else {
			// Single-group layout: internal/controller/
			controllerDir = filepath.Join(projectDir, "internal", "controller")
		}

		controllerFile := filepath.Join(controllerDir, strings.ToLower(crd.Kind)+"_controller.go")
		log.Printf("UpdateControllerRBAC: Processing controller file: %s", controllerFile)

		if _, err := os.Stat(controllerFile); os.IsNotExist(err) {
			log.Printf("Controller file does not exist, skipping: %s", controllerFile)
			continue
		}

		fset := token.NewFileSet()
		file, err := decorator.ParseFile(fset, controllerFile, nil, parser.ParseComments)
		if err != nil {
			return fmt.Errorf("parse controller file %s: %w", controllerFile, err)
		}

		// Generate RBAC markers based on user selections
		rbacMarkers := generateRBACMarkers(crd.RBAC, crd.Group)

		if len(rbacMarkers) == 0 {
			continue // No RBAC permissions selected
		}

		// Find the Reconcile function and add RBAC markers above it
		dstutil.Apply(file, func(c *dstutil.Cursor) bool {
			fn, ok := c.Node().(*dst.FuncDecl)
			if !ok || fn.Name.Name != "Reconcile" {
				return true
			}

			// Add RBAC markers before the Reconcile function
			fn.Decs.Start.Append(rbacMarkers...)
			log.Printf("Added %d RBAC markers to Reconcile function in %s", len(rbacMarkers), controllerFile)
			return false
		}, nil)

		// Write the updated file
		var buf bytes.Buffer
		if err := decorator.Fprint(&buf, file); err != nil {
			return fmt.Errorf("print controller file %s: %w", controllerFile, err)
		}
		if err := os.WriteFile(controllerFile, buf.Bytes(), 0o644); err != nil {
			return fmt.Errorf("write controller file %s: %w", controllerFile, err)
		}
		log.Printf("Updated controller file with RBAC markers: %s", controllerFile)
	}
	return nil
}

// generateRBACMarkers creates kubebuilder RBAC markers based on user selections
func generateRBACMarkers(rbac []RBACPermission, crdGroup string) []string {
	var markers []string

	// Always add permissions for the CRD itself
	markers = append(markers, fmt.Sprintf("// +kubebuilder:rbac:groups=%s,resources=%ss,verbs=get;list;watch;create;update;patch;delete", crdGroup, strings.ToLower(crdGroup)))
	markers = append(markers, fmt.Sprintf("// +kubebuilder:rbac:groups=%s,resources=%ss/status,verbs=get;update;patch", crdGroup, strings.ToLower(crdGroup)))
	markers = append(markers, fmt.Sprintf("// +kubebuilder:rbac:groups=%s,resources=%ss/finalizers,verbs=update", crdGroup, strings.ToLower(crdGroup)))

	// Add user-defined RBAC permissions
	for _, permission := range rbac {
		if permission.Group != "" || permission.Resources != "" || permission.Verbs != "" {
			group := permission.Group
			if group == "" {
				group = `""`
			}
			markers = append(markers, fmt.Sprintf("// +kubebuilder:rbac:groups=%s,resources=%s,verbs=%s", group, permission.Resources, permission.Verbs))
		}
	}

	return markers
}

func main() {
	r := gin.Default()
	r.POST("/v1/run", runOperatorSDK)
	log.Println("Starting server on :8080...")
	r.Run(":8080")
}
