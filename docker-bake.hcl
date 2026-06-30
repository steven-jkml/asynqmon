variable "VERSION" {
  default = "v90.7.4"
}

group "default" {
  targets = ["scratch"]
}

target "scratch" {
  cache-from = [
    "ghcr.io/steven-jkml/asynqmon"
  ]

  args = {
    ARCH    = "amd64"
    VERSION = "${VERSION}"
  }

  tags = [
    "ghcr.io/steven-jkml/asynqmon:v${VERSION}"
  ]
}
