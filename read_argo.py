import xarray as xr
import pandas as pd
import numpy as np
import os

nc_file = r"data/argo/profiles/D1900050_001.nc"

output_csv = r"data/argo/argo_measurements.csv"

print("Opening Argo NetCDF...")

ds = xr.open_dataset(nc_file)

print("\nNetCDF opened successfully")

rows = []

latitude = float(ds["LATITUDE"].values[0])
longitude = float(ds["LONGITUDE"].values[0])
time = ds["JULD"].values[0]

for level in range(ds.sizes["N_LEVELS"]):

    pressure = ds["PRES"].values[0, level]
    temperature = ds["TEMP"].values[0, level]
    salinity = ds["PSAL"].values[0, level]

    if np.isnan(pressure):
        continue

    rows.append({
        "source": "ARGO",
        "platform": "FLOAT",
        "platform_number": str(ds["PLATFORM_NUMBER"].values[0]),
        "cycle": int(ds["CYCLE_NUMBER"].values[0]),
        "latitude": latitude,
        "longitude": longitude,
        "time": str(time),
        "pressure_dbar": float(pressure),
        "temperature_c": float(temperature) if not np.isnan(temperature) else None,
        "salinity_psu": float(salinity) if not np.isnan(salinity) else None
    })

df = pd.DataFrame(rows)

os.makedirs(os.path.dirname(output_csv), exist_ok=True)

df.to_csv(output_csv, index=False)

print("\n==============================")
print("ARGO DATA")
print("==============================")

print(df)

print("\nNumber of observations:", len(df))

print("\nSaved to:")
print(output_csv)