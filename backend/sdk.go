package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	v1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
)

func RunOperatorSDK(data OperatorData) (string, error) {
	if executionMode == "kubernetes" {
		return runOperatorSDKInKubernetes(data)
	}
	// return runOperatorSDKLocally(data)
	return "", fmt.Errorf("local execution mode is not implemented yet")
}

func runOperatorSDKInKubernetes(data OperatorData) (string, error) {
	config, err := rest.InClusterConfig()
	if err != nil {
		return "", fmt.Errorf("failed to get in-cluster config: %w", err)
	}

	clientset, err := kubernetes.NewForConfig(config)
	if err != nil {
		return "", fmt.Errorf("failed to create Kubernetes client: %w", err)
	}

	runnerNamespace := os.Getenv("OPERATOR_SDK_RUNNER_NAMESPACE")

	// Generate a unique pod name using timestamp and project name
	uniquePodName := fmt.Sprintf("%s-%s-%d", os.Getenv("OPERATOR_SDK_RUNNER_NAME"), strings.ToLower(data.ProjectName), time.Now().Unix())

	pod := &v1.Pod{
		ObjectMeta: metav1.ObjectMeta{
			Name:      uniquePodName,
			Namespace: runnerNamespace,
		},
		Spec: v1.PodSpec{
			Containers: []v1.Container{
				{
					Name:  uniquePodName,
					Image: os.Getenv("OPERATOR_SDK_RUNNER_IMAGE"),
				},
			},
			RestartPolicy: v1.RestartPolicyNever,
		},
	}

	// Create the pod
	_, err = clientset.CoreV1().Pods(runnerNamespace).Create(context.TODO(), pod, metav1.CreateOptions{})
	if err != nil {
		return "", fmt.Errorf("failed to create pod: %w", err)
	}

	// Wait for the pod to be ready with a timeout
	const podWaitTimeout = 120 // seconds
	const pollInterval = 2     // seconds
	startTime := time.Now()
	var runnerPod v1.Pod
	for {
		p, err := clientset.CoreV1().Pods(runnerNamespace).Get(context.TODO(), uniquePodName, metav1.GetOptions{})
		if err != nil {
			return "", fmt.Errorf("failed to get pod status: %w", err)
		}

		if p.Status.Phase == v1.PodRunning {
			runnerPod = *p
			break
		} else if p.Status.Phase == v1.PodFailed {
			return "", fmt.Errorf("pod failed: %s", p.Status.Message)
		}

		if time.Since(startTime).Seconds() > float64(podWaitTimeout) {
			return "", fmt.Errorf("timed out waiting for pod to be ready")
		}

		time.Sleep(time.Duration(pollInterval) * time.Second)
	}

	// Call the /v1/run endpoint with OperatorData
	httpClient := &http.Client{}
	url := "http://" + runnerPod.Status.PodIP + ":8080/v1/run"
	jsonData, err := json.Marshal(data)
	if err != nil {
		return "", fmt.Errorf("failed to marshal OperatorData: %w", err)
	}
	req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return "", fmt.Errorf("failed to create HTTP request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("failed to call /v1/run endpoint: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("/v1/run endpoint returned status: %s", resp.Status)
	}

	// Save the zip file locally with a prefix related to the HTTP payload
	zipFileName := fmt.Sprintf("%s_output.zip", data.ProjectName)
	zipFilePath := filepath.Join(os.TempDir(), zipFileName)
	zipFile, err := os.Create(zipFilePath)
	if err != nil {
		return "", fmt.Errorf("failed to create zip file: %w", err)
	}
	defer zipFile.Close()
	if _, err := io.Copy(zipFile, resp.Body); err != nil {
		return "", fmt.Errorf("failed to save zip file: %w", err)
	}

	// Clean up the pod
	err = clientset.CoreV1().Pods(runnerNamespace).Delete(context.TODO(), uniquePodName, metav1.DeleteOptions{})
	if err != nil {
		log.Printf("Warning: failed to delete pod %s: %v", uniquePodName, err)
	}

	return zipFilePath, nil
}
