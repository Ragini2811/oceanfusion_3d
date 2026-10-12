import xarray as xr
import pandas as pd
import numpy as np
import os

input_file = r"data/glider/sea037/sea037_20250918_R.nc"
output_file = r"data/processed/glider_sea037.csv"

ds = xr.open_dataset(input_file)

data = pd.DataFrame({
    "source": "GLIDER",
    "platform": "SEA037",
    "platform_id": "6801558",
    "time": ds["TIME"].values,
    "latitude": ds["LATITUDE"].values,
    "longitude": ds["LONGITUDE"].values,
    "depth": np.nan,
    "pressure": ds["PRES"].values,
    "temperature": ds["TEMP"].values,
    "salinity": ds["PSAL"].values,
    "conductivity": ds["CNDC"].values,
    "oxygen": ds["DOXY"].values,
    "current_u": np.nan,
    "current_v": np.nan
})

data = data.replace([np.inf, -np.inf], np.nan)

data = data.dropna(
    subset=[
        "time",
        "latitude",
        "longitude",
        "pressure"
    ]
)

data = data[
    (data["latitude"] >= -90) &
    (data["latitude"] <= 90) &
    (data["longitude"] >= -180) &
    (data["longitude"] <= 180) &
    (data["pressure"] >= 0)
]

data = data.sort_values("time")

os.makedirs("data/processed", exist_ok=True)

data.to_csv(output_file, index=False)

print("Glider normalization completed")
print("Output:", output_file)
print("Rows:", len(data))
print("\nColumns:")
print(data.columns.tolist())
print("\nFirst rows:")
print(data.head())