'use strict'

module.exports.buildArtifactUrl = (projectPath, jobId, artifactPath) =>
  `https://gitlab.com/${projectPath}/-/jobs/${jobId}/artifacts/file/${artifactPath}`
