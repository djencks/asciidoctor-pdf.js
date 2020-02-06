#!/bin/bash

echo "cloning antora"
git clone https://gitlab.com/djencks/antora.git
(cd antora;git checkout issue-522-347-548-asciidoctor-2-delegating-converters-explicit-converters)
echo "done"

echo "cloning asciidoctor-pdf.js"
git clone https://github.com/djencks/asciidoctor-pdf.js.git
(cd asciidoctor-pdf.js;git checkout antora)
echo "done"

echo "cloning antora-ui-default"
git clone https://gitlab.com/djencks/antora-ui-default
(cd antora-ui-default;git checkout pdf-with-hbs)
echo "done"

echo "running yarn on antora"
(cd antora;yarn)
echo "done"

echo "running yarn on asciidoctor-pdf.js"
(cd asciidoctor-pdf.js;yarn)
echo "done"

echo "building default ui bundle"
(cd antora-ui-default;npm install;gulp)
echo "done"

CWD=`pwd`

export ANTORA_PDF_DEV=$CWD/asciidoctor-pdf.js/node_modules/@antora/cli/bin/antora

export ANTORA_PDF_CMD="$ANTORA_PDF_DEV --generator $CWD/asciidoctor-pdf.js/node_modules/@antora-pdf/pdf-generator --ui-bundle-url $CWD/antora-ui-default/build/ui-pdf-bundle.zip --ui-start-path pdf --stacktrace"

echo "Consider defining these in your .profile or equivalent:"
echo "export ANTORA_PDF_DEV="$ANTORA_PDF_DEV
echo "export ANTORA_PDF_CMD=\""$ANTORA_PDF_CMD\"

echo "run antora-pdf with:"
echo "\$ANTORA_PDF_CMD <path-to-playbook>"
echo "or, to suspend and leave the server running,"
echo "\$ANTORA_PDF_CMD <path-to-playbook> --attribute antoraPdfSuspendServer=true"
