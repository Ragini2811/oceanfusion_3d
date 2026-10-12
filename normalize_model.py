import xarray as xr
import pandas as pd
import numpy as np
import os

input_file = r"data/model/indian_ocean_model_test.nc"
output_file = r"data/processed/model_indian_ocean.csv"

ds = xr.open_dataset(input_file)

df = ds.to_dataframe().reset_index()

df = df.rename(columns={
    "thetao": "temperature",
    "so": "salinity",
    "uo": "current_u",
    "vo": "current_v"
})

df["source"] = "MODEL"
df["platform"] = "COPERNICUS"
df["platform_id"] = "cmems_mod_glo_phy_my_0.083deg_P1D-m"

df["pressure"] = np.nan
df["conductivity"] = np.nan
df["oxygen"] = np.nan

df = df[
    [
        "source",
        "platform",
        "platform_id",
        "time",
        "latitude",
        "longitude",
        "depth",
        "pressure",
        "temperature",
        "salinity",
        "conductivity",
        "oxygen",
        "current_u",
        "current_v"
    ]
]

df = df.replace([np.inf, -np.inf], np.nan)

df = df.dropna(
    subset=[
        "time",
        "latitude",
        "longitude",
        "depth"
    ]
)

os.makedirs("data/processed", exist_ok=True)

df.to_csv(output_file, index=False)

print("Model normalization completed")
print("Output:", output_file)
print("Rows:", len(df))
print("\nColumns:")
print(df.columns.tolist())
print("\nFirst rows:")
print(df.head())