from abc import ABCMeta, abstractmethod

class DataLoader(object):
    __metaclass__ = ABCMeta

    @abstractmethod
    def video_list(self):
        """
        Returns:
            videos (list): List containing video names as strings.
        """
        pass

    @abstractmethod
    def video_groundtruth(self, video_name):
        """
        Args:
            video_name (str): One video name from the list returned by
                video_list.

        Returns:
            groundtruth (list): Each element is a tuple of the form
                (start_sec, end_sec, label)
        """
        pass

    @abstractmethod
    def video_predictions(self, video_name):
        """
        Args:
            video_name (str): One video name from the list returned by
                video_list.

        Returns:
            predictions (dict): Maps label name to list of floats representing
                confidences. The list spans the length of the video.
        """
        pass
