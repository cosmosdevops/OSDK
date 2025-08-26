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

type CRD struct {
	Group      string           `json:"group" validate:"required,alphanum|alphanumunicode"`
	Version    string           `json:"version" validate:"required,alphanum|alphanumunicode"`
	Kind       string           `json:"kind" validate:"required,alphanum|alphanumunicode"`
	Plural     string           `json:"plural" validate:"omitempty,alphanum|alphanumunicode"`
	Controller bool             `json:"controller" validate:"required"`
	Status     bool             `json:"status"`
	RBAC       []RBACPermission `json:"rbac"`
	Properties []Property       `json:"properties" validate:"dive,required"`
}

type OperatorData struct {
	Domain      string   `json:"domain" validate:"required,hostname_rfc1123"`
	Repo        string   `json:"repo" validate:"required"`
	ProjectName string   `json:"projectName" validate:"required,alphanum|alphanumunicode"`
	Namespaces  []string `json:"namespaces"`
	CRDs        []CRD    `json:"crds" validate:"required,dive,required"`
}
