def load_multithumos():
    from .multithumos import MultiThumosDataLoader
    return MultiThumosDataLoader


def load_charades():
    from .charades import CharadesDataLoader
    return CharadesDataLoader


def load_imagenet_vid():
    from .imagenet_vid import ImagenetVidDataLoader
    return ImagenetVidDataLoader


def load_surgery():
    from .surgery import SurgeryDataLoader
    return SurgeryDataLoader


data_loaders = {
    'multithumos': load_multithumos,
    'charades': load_charades,
    'imagenet-vid': load_imagenet_vid,
    'surgery': load_surgery,
}


def get_data_loader(loader_name):
    if loader_name not in data_loaders:
        raise KeyError('Invalid loader {}. Must be one of {}'.format(
            loader_name, data_loaders.keys()))
    return data_loaders[loader_name]()
