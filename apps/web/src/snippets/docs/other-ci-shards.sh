export STATEOFPIXEL_TOKEN=sop_...
export STATEOFPIXEL_NONCE="$CI_PIPELINE_ID"

npx stateofpixel upload screenshots --shard 2/4
