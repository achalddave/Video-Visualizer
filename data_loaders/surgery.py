import csv
from pathlib import Path

from .data_loader import DataLoader


class SurgeryDataLoader(DataLoader):
    def __init__(self, data_dir):
        # Data dir should be structured like so:
        # data/
        #    Rocuronium/    # note: name indicates label for video
        #         Vial_Solomon_Clip1.mp4
        #         Vial_Solomon_Clip1.csv  # note: must have same name as mp4
        self.data_dir = Path(data_dir)
        videos = list(self.data_dir.rglob("*.mp4"))
        self.videos = {}
        for v in videos:
            self.videos[v.name] = {"path": v, "label_path": v.with_suffix(".csv"), "label": v.parent.name}

    def get_video(self, video_name):
        """
        Returns:
            video_path (Path): Path to video file.
        """
        print(video_name, self.videos[video_name]["path"])
        return self.videos[video_name]["path"]

    def video_list(self):
        """
        Returns:
            videos (list): List containing video names as strings.
        """
        return list(self.videos.keys())

    def video_groundtruth(self, video_name):
        """
        Args:
            video_name (str): One video name from the list returned by video_list.

        Returns:
            groundtruth (list): Each element is a tuple of the form (start_sec, end_sec, label)
        """
        return [(0, 1000000, self.videos[video_name]["label"])]

    def video_predictions(self, video_name):
        """
        Args:
            video_name (str): One video name from the list returned by
                video_list.

        Returns:
            predictions (dict): Maps label name to list of floats representing
                confidences. The list spans the length of the video.
        """
        # Map frame index to label name
        frame_labels = {}
        with open(self.videos[video_name]["label_path"], "r") as f:
            reader = csv.reader(f)
            for row in reader:
                frame_raw = row[0].split(video_name.split(".")[0])[1]
                if len(frame_raw) == 0:
                    frame = 0
                else:
                    frame = int(frame_raw) - 1
                frame_labels[frame] = row[1]
        label_set = set(frame_labels.values())
        # Map label name to confidence for each frame.
        labels = {k: [0] * len(frame_labels) for k in label_set}
        for frame, label in frame_labels.items():
            labels[label][frame] = 1.0
        return labels
