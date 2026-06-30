.PHONY: api assets build docker push-ecr push-ecr-qa

LOCAL_IMAGE ?= omni_asynqmon
ECR_REPOSITORY ?= 687566970408.dkr.ecr.ap-southeast-1.amazonaws.com/omni/hibiken/asynqmon/release
ECR_REPOSITORY_QA ?= 347884968006.dkr.ecr.ap-southeast-1.amazonaws.com/omni/hibiken/asynqmon/release

NODE_PATH ?= $(PWD)/ui/node_modules
assets:
	@if [ ! -d "$(NODE_PATH)"  ]; then cd ./ui && yarn install --modules-folder $(NODE_PATH); fi
	cd ./ui && yarn build --modules-folder $(NODE_PATH)

# This target skips the overhead of building UI assets.
# Intended to be used during development.
api:
	go build -o api ./cmd/asynqmon

# Build a release binary.
build: assets
	go build -o asynqmon ./cmd/asynqmon

# Build a release binary.
build-local-prometheus:
	go build ./test/example/prometheus

# Run
run-local-asynqmon:
	./asynqmon --enable-metrics-exporter --prometheus-addr=http://localhost:9191

run-local-prometheus:
	./prometheus --port=9191

# Build image and run Asynqmon server (with default settings).
docker:
	docker build -t $(LOCAL_IMAGE) .

docker-run:
	docker run --rm \
		--name asynqmon \
		-p 8080:8080 \
		$(LOCAL_IMAGE) --redis-addr=host.docker.internal:6379

push-ecr:
	@if [ -z "$(IMAGE_TAG)" ]; then echo "IMAGE_TAG is required. Usage: make push-ecr IMAGE_TAG=<tag>"; exit 1; fi
	@docker image inspect $(LOCAL_IMAGE) >/dev/null 2>&1 || { echo "Local Docker image '$(LOCAL_IMAGE)' not found. Build it first with: docker build -t $(LOCAL_IMAGE) ."; exit 1; }
	docker tag $(LOCAL_IMAGE) $(ECR_REPOSITORY):$(IMAGE_TAG)
	docker push $(ECR_REPOSITORY):$(IMAGE_TAG)

push-ecr-qa:
	@if [ -z "$(IMAGE_TAG)" ]; then echo "IMAGE_TAG is required. Usage: make push-ecr-qa IMAGE_TAG=<tag>"; exit 1; fi
	@docker image inspect $(LOCAL_IMAGE) >/dev/null 2>&1 || { echo "Local Docker image '$(LOCAL_IMAGE)' not found. Build it first with: docker build -t $(LOCAL_IMAGE) ."; exit 1; }
	docker tag $(LOCAL_IMAGE) $(ECR_REPOSITORY_QA):$(IMAGE_TAG)
	docker push $(ECR_REPOSITORY_QA):$(IMAGE_TAG)
