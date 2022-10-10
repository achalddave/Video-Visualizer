## Installation

```
pip install flask
```

## Setup video data

1. Move data to `videos` folder under the root directory.
2. The videos folder should have a structure like this:
    ./videos
        ./Rocuronium/
            ./Vial_Solomon_Clip_44.csv  # Note: Should be the same name as the mp4
            ./Vial_Solomon_Clip_44.mp4
        ./Nesostigmine
            ./Vial_Solomon_Clip_23.csv
            ./Vial_Solomon_Clip_23.mp4
        [...]

## Convert all videos to be playable in browsers

The videos may not play in the browser directly due to how they are encoded. To
fix this, run the following command for all videos:

```
mv Vial_Solomon_Clip_44.mp4 Vial_Solomon_Clip_44_old.mp4
ffmpeg -i Vial_Solomon_Clip_44_old.mp4 -vcodec libx264 -acodec aac Vial_Solomon_Clip_44.mp4
```

## Run the visualization tool

FLASK_APP=video_visualizer.py FLASK_CONFIG=surgery_vis.cfg flask run
