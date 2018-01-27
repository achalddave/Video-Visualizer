import collections

from .multithumos import MultiThumosDataLoader


class CharadesDataLoader(MultiThumosDataLoader):
    def load_class_mapping(self, class_list_path):
        mapping = collections.OrderedDict()
        with open(class_list_path) as f:
            for line in f:
                details = line.strip().split(' ')
                mapping[int(details[0])] = ' '.join(details[1:])
        return mapping
