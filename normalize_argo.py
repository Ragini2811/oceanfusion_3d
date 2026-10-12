import xarray as xr
import pandas as pd
import numpy as np
import os

input_file = r"data/argo/D1900050_001.nc"
output_file = r"data/processed/argo.csv"

ds = xr.open_dataset(input_file)

time = ds["JULD"].values

latitude = ds["LATITUDE"].values
longitude = ds["LONGITUDE"].values
pressure = ds["PRES"].values
temperature = ds["TEMP"].values
salinity = ds["PSAL"].values

rows = []

for profile in range(len(latitude)):

    for level in range(pressure.shape[1]):

        p = pressure[profile, level]

        if np.isnan(p):
            continue

        rows.append({
            "source": "ARGO",
            "platform": "ARGO",
            "platform_id": str(ds["WMO"].values[profile]) if "WMO" in ds else "UNKNOWN",
            "time": time[profile],
            "latitude": latitude[profile],
            "longitude": longitude[profile],
            "depth": np.nan,
            "pressure": p,
            "temperature": temperature[profile, level],
            "salinity": salinity[profile, level],
            "conductivity": np.nan,
            "oxygen": np.nan,
            "current_u": np.nan,
            "current_v": np.nan
        })

df = pd.DataFrame(rows)

df = df.replace([np.inf, -np.inf], np.nan)

df.to_csv(output_file, index=False)

print("Argo normalization completed")
print("Output:", output_file)
print("Rows:", len(df))
print("\nFirst rows:")
print(df.head())