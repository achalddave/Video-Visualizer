import os

import flask
from flask import Flask, render_template

from . import data_loaders

app = Flask(__name__)
app.config.from_pyfile(os.environ['FLASK_CONFIG'])
data_loader = data_loaders.get_data_loader(app.config['DATA_LOADER'])(
    **app.config['DATA_LOADER_CONFIG'])


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/video_list')
def video_list():
    return flask.jsonify(data_loader.video_list())


@app.route('/video/<path:video_name>')
def video(video_name):
    video_path = data_loader.get_video(video_name)
    return flask.send_from_directory(video_path.parent, video_path.name)


@app.route('/groundtruth/<video_name>')
def groundtruth(video_name):
    return flask.jsonify(data_loader.video_groundtruth(video_name))


@app.route('/predictions/<video_name>')
def predictions(video_name):
    return flask.jsonify(data_loader.video_predictions(video_name))


if __name__ == '__main__':
    app.run()
