from __future__ import annotations

import os
from functools import lru_cache

import h5py
import numpy as np
from flask import Flask, jsonify, request
from flask_cors import CORS


ROOT = os.path.dirname(os.path.abspath(__file__))
MODEL_FILE = os.path.join(ROOT, "data", "model", "indian_ocean_model_test.nc")
MAX_XY = 64

app = Flask(__name__)
CORS(app)


def _number(value, fallback):
    try:
        return float(value)
    except (TypeError, ValueError):
        return fallback


def _indices(values, low, high, limit):
    lo = min(low, high)
    hi = max(low, high)
    hits = np.flatnonzero((values >= lo) & (values <= hi))
    if hits.size == 0:
        nearest = np.array([int(np.abs(values - ((lo + hi) / 2)).argmin())])
        return nearest
    step = max(1, int(np.ceil(hits.size / limit)))
    return hits[::step]


def _decode(dataset, raw):
    values = raw.astype(np.float32)
    fill = dataset.attrs.get("_FillValue")
    if fill is not None:
        values[values == np.asarray(fill).reshape(-1)[0]] = np.nan
    scale = float(np.asarray(dataset.attrs.get("scale_factor", 1)).reshape(-1)[0])
    offset = float(np.asarray(dataset.attrs.get("add_offset", 0)).reshape(-1)[0])
    return values * scale + offset


@lru_cache(maxsize=16)
def extract_volume(west, east, south, north, max_depth, nx, ny):
    with h5py.File(MODEL_FILE, "r") as source:
        longitude = source["longitude"][:]
        latitude = source["latitude"][:]
        depth = source["depth"][:]
        depth_count = max(1, int(np.searchsorted(depth, max_depth, side="right")))
        depth = depth[:depth_count]
        x = _indices(longitude, west, east, nx)
        y = _indices(latitude, south, north, ny)
        x0, x1 = int(x[0]), int(x[-1])
        y0, y1 = int(y[0]), int(y[-1])
        x = np.arange(x0, x1 + 1, max(1, int(np.ceil((x1 - x0 + 1) / nx))))
        y = np.arange(y0, y1 + 1, max(1, int(np.ceil((y1 - y0 + 1) / ny))))
        temperature = _decode(source["thetao"], source["thetao"][0, :depth_count, y, :][:, :, x])
        salinity = _decode(source["so"], source["so"][0, :depth_count, y, :][:, :, x])

    temperature_range = [float(np.nanmin(temperature)), float(np.nanmax(temperature))]
    salinity_range = [float(np.nanmin(salinity)), float(np.nanmax(salinity))]
    temperature = np.nan_to_num(temperature, nan=temperature_range[0])
    salinity = np.nan_to_num(salinity, nan=salinity_range[0])
    return {
        "longitude": longitude[x].astype(float).tolist(),
        "latitude": latitude[y].astype(float).tolist(),
        "depth": depth.astype(float).tolist(),
        "temperature": temperature.astype(float).ravel().tolist(),
        "salinity": salinity.astype(float).ravel().tolist(),
        "shape": [int(len(depth)), int(len(y)), int(len(x))],
        "temperatureRange": temperature_range,
        "salinityRange": salinity_range,
        "source": "data/model/indian_ocean_model_test.nc",
    }


@app.get("/api/volume")
def volume():
    west = _number(request.args.get("west"), 40)
    east = _number(request.args.get("east"), 100)
    south = _number(request.args.get("south"), -30)
    north = _number(request.args.get("north"), 30)
    max_depth = max(1.0, _number(request.args.get("maxDepth"), 5000))
    return jsonify(extract_volume(west, east, south, north, max_depth, MAX_XY, MAX_XY))


@app.get("/api/health")
def health():
    return jsonify({"ok": True, "model": os.path.exists(MODEL_FILE)})


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=8001, debug=False)
