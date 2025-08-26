package main

import (
	"archive/zip"
	"flag"
	"io"
	"io/fs"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/go-playground/validator/v10"
)

func zipDir(srcDir string, w io.Writer) error {
	zipWriter := zip.NewWriter(w)
	defer zipWriter.Close()
	return filepath.WalkDir(srcDir, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if d.IsDir() {
			return nil
		}
		relPath, err := filepath.Rel(srcDir, path)
		if err != nil {
			return err
		}
		f, err := zipWriter.Create(relPath)
		if err != nil {
			return err
		}
		srcFile, err := os.Open(path)
		if err != nil {
			return err
		}
		defer srcFile.Close()
		_, err = io.Copy(f, srcFile)
		return err
	})
}

var validate = validator.New()

var executionMode string

func init() {
	flag.StringVar(&executionMode, "execution-mode", "kubernetes", "Execution mode: 'local' or 'kubernetes'")
	flag.Parse()
}

func main() {
	gin.SetMode(gin.ReleaseMode)
	r := gin.Default()

	// Use the CORS middleware
	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"*"},
		AllowMethods:     []string{"POST", "GET", "OPTIONS", "PUT", "DELETE"},
		AllowHeaders:     []string{"Accept", "Content-Type", "Content-Length", "Accept-Encoding", "X-CSRF-Token", "Authorization"},
		AllowCredentials: true,
	}))

	r.GET("/healthz", func(c *gin.Context) {
		c.String(http.StatusOK, "ok")
	})

	r.POST("/api/v1/generate", func(c *gin.Context) {
		var data OperatorData
		if err := c.ShouldBindJSON(&data); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		if err := validate.Struct(&data); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		log.Printf("Received data: %+v\n", data)
		result, err := RunOperatorSDK(data)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		filename := data.ProjectName
		if filename == "" {
			filename = "operator-sdk-project"
		}

		var zipFilePath string
		var needsCleanup bool

		if strings.HasSuffix(result, ".zip") {
			zipFilePath = result
			needsCleanup = false
		} else {
			// Directory that needs to be zipped (local execution)
			zipFilePath = filepath.Join(os.TempDir(), filename+".zip")
			zipFile, err := os.Create(zipFilePath)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create zip file: " + err.Error()})
				return
			}

			if err := zipDir(result, zipFile); err != nil {
				zipFile.Close()
				os.Remove(zipFilePath)
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to zip project: " + err.Error()})
				return
			}
			zipFile.Close()
			needsCleanup = true
		}

		// Get file size for Content-Length header
		fileInfo, err := os.Stat(zipFilePath)
		if err != nil {
			if needsCleanup {
				os.Remove(zipFilePath)
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get zip file info: " + err.Error()})
			return
		}
		fileSize := fileInfo.Size()
		log.Printf("Zip file created with size: %d bytes", fileSize)

		c.FileAttachment(zipFilePath, filename+".zip")

		if needsCleanup {
			defer os.Remove(zipFilePath)
		}
	})

	log.Println("Starting Operator SDK Backend API server on :8080...")
	r.Run(":8080")
}
