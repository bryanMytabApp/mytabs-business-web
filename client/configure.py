import subprocess
import shutil
import os
import json

dev_dependencies = []

dependencies = ["@emotion/react", "@emotion/style", "@emotion/styled", "@mdi/js", "@mdi/react", "@mui/icons-material", "@mui/material", "@mui/x-date-pickers", "@stripe/react-stripe-js", "@stripe/stripe-js", "@testing-library/jest-dom", "@testing-library/react", "@testing-library/user-event", "axios", "country-state-city", "libphonenumber-js", "moment", "react", "react-dom", "react-dropzone", "react-loading", "react-router-dom", "react-scripts", "react-svg", "react-toastify", "serverless-deployment-bucket", "serverless-s3-sync", "web-vitals"];



# Eliminar node_modules si existe
if os.path.exists("node_modules"):
    shutil.rmtree("node_modules")

# Eliminar package-lock.json si existe
if os.path.exists("package-lock.json"):
    os.remove("package-lock.json")

# Leer el archivo package.json
with open('package.json', 'r') as package_file:
    package_data = json.load(package_file)

# Eliminar devDependencies y dependencies
if 'devDependencies' in package_data:
    del package_data['devDependencies']
if 'dependencies' in package_data:
    del package_data['dependencies']

# Escribir el archivo package.json actualizado
with open('package.json', 'w') as package_file:
    json.dump(package_data, package_file, indent=2)

# Instalar devDependencies
for dependency in dev_dependencies:
    subprocess.run(["npm", "install", "--save-dev", dependency])

# Instalar dependencies
for dependency in dependencies:
    subprocess.run(["npm", "install", dependency])
