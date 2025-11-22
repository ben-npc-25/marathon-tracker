#!/bin/sh
# Recreate config file
rm -rf /usr/share/nginx/html/env-config.js
touch /usr/share/nginx/html/env-config.js

# Add assignment 
echo "window.env = {" >> /usr/share/nginx/html/env-config.js

# Read environment variables starting with VITE_
printenv | grep VITE_ | while read -r line; do
  # Split by first equals sign
  key=$(echo "$line" | cut -d '=' -f 1)
  value=$(echo "$line" | cut -d '=' -f 2-)
  # Output key-value pair
  echo "  $key: \"$value\"," >> /usr/share/nginx/html/env-config.js
done

echo "}" >> /usr/share/nginx/html/env-config.js
