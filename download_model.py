import copernicusmarine
import os

os.makedirs("data/model", exist_ok=True)

copernicusmarine.subset(
    dataset_id="cmems_mod_glo_phy_my_0.083deg_P1D-m",
    variables=[
        "thetao",
        "so",
        "uo",
        "vo"
    ],
    minimum_longitude=40,
    maximum_longitude=100,
    minimum_latitude=-20,
    maximum_latitude=25,
    minimum_depth=0,
    maximum_depth=100,
    start_datetime="2025-09-18T00:00:00",
    end_datetime="2025-09-18T00:00:00",
    output_directory="data/model",
    output_filename="indian_ocean_model_test.nc"
)

print("Model download completed.")