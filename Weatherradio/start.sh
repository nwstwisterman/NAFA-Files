#!/bin/bash

# Generate mountpoints from Streams/*.json
node generate-mounts.js > mounts.xml

# Combine base config + generated mounts
cat icecast.xml mounts.xml > final.xml

# Start Icecast
icecast -c final.xml
