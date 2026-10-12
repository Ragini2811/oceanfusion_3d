import pandas as pd
import requests
import os

csv_file = r"data/argo/selected_profiles.csv"
output_dir = r"data/argo/profiles"

os.makedirs(output_dir, exist_ok=True)

df = pd.read_csv(csv_file)

print("Number of profiles:", len(df))

print("\nColumns:")
print(df.columns.tolist())

file_path = df.iloc[0]["file"]

print("\nSelected Argo file:")
print(file_path)

url = "https://data-argo.ifremer.fr/dac" + file_path

print("\nDownloading:")
print(url)

filename = os.path.basename(file_path)

output_file = os.path.join(
    output_dir,
    filename
)

response = requests.get(
    url,
    timeout=120
)

response.raise_for_status()

with open(output_file, "wb") as f:
    f.write(response.content)

print("\nDownload completed!")
print("File saved at:")
print(output_file)