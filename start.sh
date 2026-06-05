#!/bin/bash

echo "Starting Icecast..."
icecast2 -c icecast.xml &

echo "Starting Node server..."
node index.js
