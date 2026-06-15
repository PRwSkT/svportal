import urllib.request
import re

def download_file_from_google_drive(id, destination):
    url = "https://drive.google.com/uc?export=download"
    session = urllib.request.build_opener(urllib.request.HTTPCookieProcessor())
    request = urllib.request.Request(url + '&id=' + id)
    response = session.open(request)
    
    token = None
    for cookie in session.cookiejar:
        if cookie.name == 'download_warning':
            token = cookie.value
            break
            
    if token:
        request = urllib.request.Request(url + '&id=' + id + '&confirm=' + token)
        response = session.open(request)

    with open(destination, "wb") as f:
        f.write(response.read())

try:
    print("Downloading 1...")
    download_file_from_google_drive('13WHQA670Wc_RnaVk0xABob1DLZO7PfWg', '/tmp/vid1.mp4')
    print("Downloading 2...")
    download_file_from_google_drive('1_iFp579PQjXfqQNUuAcIUco7O6IHqsXT', '/tmp/vid2.mp4')
    print("Done")
except Exception as e:
    print("Error:", e)
