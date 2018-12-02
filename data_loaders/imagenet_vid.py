import json
from pathlib import Path

import h5py
import numpy as np

from .data_loader import DataLoader


def is_video_path(path):
    if isinstance(path, Path):
        path = path.name
    return any(path.endswith(x) for x in ['.mp4', '.avi'])


class ImagenetVidDataLoader(DataLoader):
    def __init__(self, videos_dir, predictions_hdf5_dir, index_label_mapping):
        """
        Args:
            videos_dir (Path): Contains video for each video.
            predictions_hdf5 (Path): Directory, contains <video_name>.h5 for
                each video.
            index_label_mapping (Path): Path to json mapping label index to
                (wordnet_id, description) tuple.
        """
        if isinstance(videos_dir, str):
            videos_dir = Path(videos_dir)
        if isinstance(predictions_hdf5_dir, str):
            predictions_hdf5_dir = Path(predictions_hdf5_dir)

        self.video_paths = {
            x.stem: x for x in videos_dir.iterdir() if is_video_path(x)
        }
        self.predictions_hdf5_dir = predictions_hdf5_dir
        with open(index_label_mapping, 'r') as f:
            self.index_label_mapping = {
                int(index): (wordnet_id, description)
                for index, (wordnet_id, description) in json.load(f).items()
            }

    def get_video(self, video_name):
        return self.video_paths[video_name]

    def video_list(self):
        """
        Returns:
            videos (list): List containing video names as strings.
        """
        return list(self.video_paths.keys())

    def video_groundtruth(self, video_name):
        """
        Args:
            video_name (str): One video name from the list returned by
                video_list.

        Returns:
            groundtruth (list): Each element is a tuple of the form
                (start_sec, end_sec, label)
        """
        return []

    def video_predictions(self, video_name):
        """
        Args:
            video_name (str): One video name from the list returned by
                video_list.

        Returns:
            predictions (dict): Maps label name to list of floats representing
                confidences. The list spans the length of the video.
        """
        video_h5_path = self.predictions_hdf5_dir / (video_name + '.h5')
        print(video_h5_path)
        assert video_h5_path.exists()
        with h5py.File(video_h5_path, 'r') as f:
            predictions_np = np.array(f['features'])
        return {
            description: predictions_np[:, index].tolist()
            for index, (_, description) in self.index_label_mapping.items()
        }
