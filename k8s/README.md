# Kubernetes Manifests for IT Ticket Assistant Backend

This directory contains production-ready Kubernetes manifests and network policies for deploying the Node.js backend to a Kubernetes cluster using `kubectl` and `kustomize`.

## Overview

- **Namespace**: `ticket-assitant`
- **Application URL**: `https://api.thama.dpdns.org`
- **Ingress Controller**: Traefik (`ingressClassName: traefik`)
- **TLS**: Managed by cert-manager / Traefik (`ticket-backend-tls`)
- **Security Policy**: Zero-Trust Default Deny (All Ingress & Egress denied by default, with explicit whitelisting)

## Directory Structure

```
backend/k8s/
├── namespace.yaml                # Target namespace: ticket-assitant
├── kustomization.yaml            # Root Kustomize overlay
├── backend/
│   ├── deployment.yaml           # Backend Deployment (port 5000, liveness/readiness probes)
│   ├── service.yaml              # ClusterIP service (port 80 & 5000)
│   ├── ingress.yaml              # Ingress routing api.thama.dpdns.org to backend
│   ├── hpa.yaml                  # Horizontal Pod Autoscaler (2 to 5 replicas)
│   ├── pdb.yaml                  # Pod Disruption Budget (maxUnavailable: 1)
│   └── kustomization.yaml
├── serviceaccount/
│   ├── backend-sa.yaml           # Dedicated non-root ServiceAccount
│   └── kustomization.yaml
└── networkpolicy/
    ├── default-deny.yaml         # Zero-Trust Network Policies
    └── kustomization.yaml
```

## Network Policy Architecture

1. **Default Deny All (`default-deny-all`)**: Denies all inbound and outbound traffic across all pods in `ticket-assitant`.
2. **DNS Whitelist (`allow-dns-egress`)**: Enables pods to resolve cluster hostnames via `kube-dns` on port 53 (UDP/TCP).
3. **Ingress Whitelist (`allow-ingress-to-backend`)**: Allows incoming traffic to backend port 5000 strictly from the Traefik Ingress controller in `kube-system` or `traefik`.
4. **Backend Egress Whitelist (`allow-backend-egress`)**:
   - Outbound to MongoDB on port `27017`
   - Outbound to ML Microservice on port `8000`
   - Outbound to HTTPS on port `443` (for Qdrant Cloud vector database, OpenRouter at `openrouter.ai`, Gemini, OpenAI)
   - Outbound to internal DNS on port `53`

## Deployment via kubectl

### Apply all manifests at once using Kustomize:
```bash
kubectl apply -k backend/k8s/
```

### Or apply individually:
```bash
kubectl apply -f backend/k8s/namespace.yaml
kubectl apply -f backend/k8s/networkpolicy/default-deny.yaml
kubectl apply -f backend/k8s/serviceaccount/backend-sa.yaml
kubectl apply -f backend/k8s/backend/
```

### Verify rollout:
```bash
kubectl rollout status deployment/ticket-backend -n ticket-assitant
kubectl get pods,svc,ingress,networkpolicy -n ticket-assitant
```
