# Insecure Patient Lookup

This app is meant to be purposefully exploitable and insecure to demonstrate differnt vulnerabilities that could affect poorly written web apps and systems.

The case that will be examined for this repo is that of a clinic that runs this node app as the frontend for their database (see the CSV for a plaintext record), the app s able to look up patient information and display it, simple stuff, the following vulnerabilities are present in this application:

- XSS
- SQLi
- Lack of SSL / no HTTPS
- Weak, plaintext cookies for login
- Weak auth via password, without MFA or rate-limiting on the server side
