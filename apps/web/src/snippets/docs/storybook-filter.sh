npx stateofpixel storybook storybook-static \
  --include "Components/**" \
  --exclude "**/Playground" \
  --wait-for-selector "[data-ready]" \
  --delay 200
