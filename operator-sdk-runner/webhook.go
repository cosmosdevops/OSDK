package main

import (
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"
)

// CreateWebhooks creates admission webhooks for CRDs that have webhook configurations
func CreateWebhooks(projectDir string, crds []CRD) error {
	for _, crd := range crds {
		if len(crd.Webhooks) == 0 {
			continue
		}

		for _, webhook := range crd.Webhooks {

			log.Printf("Creating webhook for %s.%s (type: %s)", crd.Kind, crd.Group, webhook.Type)

			// Create webhook using operator-sdk
			args := []string{"create", "webhook", "--group", crd.Group, "--version", crd.Version, "--kind", crd.Kind, "--make=false"}

			switch webhook.Type {
			case "mutating":
				args = append(args, "--defaulting")
			case "validating":
				args = append(args, "--validation")
			case "conversion":
				args = append(args, "--conversion")
			default:
				args = append(args, "--defaulting") // default to mutating
			}

			webhookCmd := exec.Command("operator-sdk", args...)
			webhookCmd.Dir = projectDir
			output, err := webhookCmd.CombinedOutput()
			if err != nil {
				log.Printf("Warning: Failed to create webhook for %s: %s\n%s", crd.Kind, err, output)
				continue
			}
			log.Printf("Webhook created successfully for %s", crd.Kind)

			// Update webhook configuration if custom path is specified
			if webhook.Path != "" {
				if err := updateWebhookPath(projectDir, crd, webhook, crds); err != nil {
					log.Printf("Warning: Failed to update webhook path for %s: %v", crd.Kind, err)
				}
			}
		}
	}
	return nil
}

// updateWebhookPath updates the webhook path in the generated webhook configuration
func updateWebhookPath(projectDir string, crd CRD, webhook WebhookConfig, crds []CRD) error {
	log.Printf("Updating webhook path for %s: %s", crd.Kind, webhook.Path)

	// Determine the webhook file path: internal/webhook/<version>/<kind>_webhook.go
	webhookFile := filepath.Join(projectDir, "internal", "webhook", crd.Version, strings.ToLower(crd.Kind)+"_webhook.go")

	// Check if webhook file exists
	if _, err := os.Stat(webhookFile); os.IsNotExist(err) {
		log.Printf("Webhook file does not exist, skipping path update: %s", webhookFile)
		return nil
	}

	// Read the webhook file
	content, err := os.ReadFile(webhookFile)
	if err != nil {
		return fmt.Errorf("failed to read webhook file %s: %w", webhookFile, err)
	}

	// Update webhook configuration with custom values
	updatedContent := string(content)

	// Update webhook path annotation if it exists
	// Look for the webhook path annotation pattern: //+kubebuilder:webhook:path=/default-path
	pathPattern := regexp.MustCompile(`//\+kubebuilder:webhook:path=[^\s,]+`)
	if pathPattern.MatchString(updatedContent) {
		updatedContent = pathPattern.ReplaceAllString(updatedContent, "//+kubebuilder:webhook:path="+webhook.Path)
		log.Printf("Updated webhook path annotation to: %s", webhook.Path)
	}

	// Update failure policy if specified
	if webhook.FailurePolicy != "" {
		failurePolicyPattern := regexp.MustCompile(`failurePolicy=[^,\s]+`)
		if failurePolicyPattern.MatchString(updatedContent) {
			updatedContent = failurePolicyPattern.ReplaceAllString(updatedContent, "failurePolicy="+webhook.FailurePolicy)
		}
	}

	// Update side effects if specified
	if webhook.SideEffects != "" {
		sideEffectsPattern := regexp.MustCompile(`sideEffects=[^,\s]+`)
		if sideEffectsPattern.MatchString(updatedContent) {
			updatedContent = sideEffectsPattern.ReplaceAllString(updatedContent, "sideEffects="+webhook.SideEffects)
		}
	}

	// Update match policy if specified
	if webhook.MatchPolicy != "" {
		matchPolicyPattern := regexp.MustCompile(`matchPolicy=[^,\s]+`)
		if matchPolicyPattern.MatchString(updatedContent) {
			updatedContent = matchPolicyPattern.ReplaceAllString(updatedContent, "matchPolicy="+webhook.MatchPolicy)
		}
	}

	// Update admission review versions if specified
	if len(webhook.AdmissionReviewVersions) > 0 {
		versions := strings.Join(webhook.AdmissionReviewVersions, ";")
		admissionReviewPattern := regexp.MustCompile(`admissionReviewVersions=[^,\s]+`)
		if admissionReviewPattern.MatchString(updatedContent) {
			updatedContent = admissionReviewPattern.ReplaceAllString(updatedContent, "admissionReviewVersions="+versions)
		}
	}

	// Write the updated content back to the file
	if err := os.WriteFile(webhookFile, []byte(updatedContent), 0644); err != nil {
		return fmt.Errorf("failed to write updated webhook file %s: %w", webhookFile, err)
	}

	log.Printf("Successfully updated webhook configuration in: %s", webhookFile)
	return nil
}
