import collections
import math
from os import path

import h5py

from thumos_util import annotation, parsing


def sigmoid(x):
    return 1 / (1 + math.exp(-x))


class MultiThumosDataLoader(object):
    def __init__(self, videos_dir, annotations_json, predictions_hdf5,
                 class_list):
        """
        videos_dir (str): Path to directory of videos.
        annotations_json (str): Path to file with JSON annotations.
        predictions_hdf5 (str): Path to HDF5 containing annotations.
        class_list (str): Path to text file containing a list of classes.
        """
        self.videos_dir = videos_dir
        annotations = annotation.load_annotations_json(annotations_json)
        self.annotations = {}
        for filename, file_annotations in annotations.items():
            self.annotations[filename] = [(x.start_seconds, x.end_seconds,
                                           x.category)
                                          for x in file_annotations]

        self.class_mapping = parsing.load_class_mapping(class_list).values()

        # TODO(achald): Support predictions.
        self.predictions_hdf5 = predictions_hdf5

    def get_videos_dir(self):
        return self.videos_dir

    def video_groundtruth(self, video_name):
        """
        Returns:
            groundtruth (list): Each element is a tuple of the form
                (start_sec, end_sec, label)
        """
        video_name = path.splitext(video_name)[0]
        return self.annotations[video_name]

    def video_predictions(self, video_name):
        """
        Returns:
            predictions (dict): Maps label name to list of floats representing
                confidences. The list spans the length of the video.
        """
        video_name = path.splitext(video_name)[0]
        predictions = {}
        with h5py.File(self.predictions_hdf5) as predictions_f:
            predictions_matrix = predictions_f[video_name]
            predictions = {
                self.class_mapping[i]: [float(sigmoid(x))
                                        for x in predictions_matrix[:, i]]
                for i in range(predictions_matrix.shape[1])
            }
        return predictions
