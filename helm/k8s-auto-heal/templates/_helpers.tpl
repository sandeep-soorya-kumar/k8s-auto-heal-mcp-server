{{/*
Expand the name of the chart.
*/}}
{{- define "k8s-auto-heal.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
We truncate at 63 chars because some Kubernetes name fields are limited to this (by the DNS naming spec).
If release name contains chart name it will be used as a full name.
*/}}
{{- define "k8s-auto-heal.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "k8s-auto-heal.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "k8s-auto-heal.labels" -}}
helm.sh/chart: {{ include "k8s-auto-heal.chart" . }}
{{ include "k8s-auto-heal.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "k8s-auto-heal.selectorLabels" -}}
app.kubernetes.io/name: {{ include "k8s-auto-heal.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Create the name of the service account to use
*/}}
{{- define "k8s-auto-heal.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "k8s-auto-heal.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}

{{/*
Create the name of the cluster role to use
*/}}
{{- define "k8s-auto-heal.clusterRoleName" -}}
{{- if .Values.rbac.create }}
{{- default (include "k8s-auto-heal.fullname" .) .Values.rbac.clusterRoleName }}
{{- else }}
{{- default "default" .Values.rbac.clusterRoleName }}
{{- end }}
{{- end }}

{{/*
Create the name of the cluster role binding to use
*/}}
{{- define "k8s-auto-heal.clusterRoleBindingName" -}}
{{- if .Values.rbac.create }}
{{- default (include "k8s-auto-heal.fullname" .) .Values.rbac.clusterRoleBindingName }}
{{- else }}
{{- default "default" .Values.rbac.clusterRoleBindingName }}
{{- end }}
{{- end }}
