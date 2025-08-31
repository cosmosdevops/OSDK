package main

type Validation struct {
	Type  string      `json:"type"`
	Value interface{} `json:"value"`
}

type Property struct {
	Name        string       `json:"name"`
	Type        string       `json:"type"`
	Validations []Validation `json:"validations"`
}

type RBACPermission struct {
	Group     string `json:"group"`
	Resources string `json:"resources"`
	Verbs     string `json:"verbs"`
	Preset    string `json:"preset,omitempty"`
}

type WebhookConfig struct {
	Type                    string   `json:"type"`                              // "mutating", "validating", or "conversion"
	AdmissionReviewVersions []string `json:"admissionReviewVersions,omitempty"` // v1, v1beta1
	FailurePolicy           string   `json:"failurePolicy,omitempty"`           // "Fail" or "Ignore"
	SideEffects             string   `json:"sideEffects,omitempty"`             // "None", "NoneOnDryRun", "Some", "Unknown"
	MatchPolicy             string   `json:"matchPolicy,omitempty"`             // "Exact" or "Equivalent"
	Path                    string   `json:"path,omitempty"`                    // webhook path (e.g., "/mutate-v1-pod")
	Operations              []string `json:"operations,omitempty"`              // "CREATE", "UPDATE", "DELETE"
	Resources               []string `json:"resources,omitempty"`               // resources to watch
	Enabled                 bool     `json:"enabled"`
}

type CRD struct {
	Group      string           `json:"group" validate:"required,alphanum|alphanumunicode"`
	Version    string           `json:"version" validate:"required,alphanum|alphanumunicode"`
	Kind       string           `json:"kind" validate:"required,alphanum|alphanumunicode"`
	Plural     string           `json:"plural" validate:"omitempty,alphanum|alphanumunicode"`
	Controller bool             `json:"controller" validate:"required"`
	Status     bool             `json:"status"`
	RBAC       []RBACPermission `json:"rbac"`
	Properties []Property       `json:"properties" validate:"dive,required"`
	Webhooks   []WebhookConfig  `json:"webhooks,omitempty"`
}

type OperatorData struct {
	Domain      string   `json:"domain" validate:"required,hostname_rfc1123"`
	Repo        string   `json:"repo" validate:"required"`
	ProjectName string   `json:"projectName" validate:"required,alphanum|alphanumunicode"`
	Namespaces  []string `json:"namespaces"`
	CRDs        []CRD    `json:"crds" validate:"required,dive,required"`
}
