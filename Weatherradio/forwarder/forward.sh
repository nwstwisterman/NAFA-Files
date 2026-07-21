#!/bin/bash

ffmpeg -i http://icecast:8000/stream \
  -c:a aac -b:a 64k \
  -f mp3 \
  -content_type audio/mpeg \
  -method POST \
  http://hls-server:3000/upload/WXL20
