# iNaturalist Places Safari

A way to get out and look for plants

## Picking your places

To include an iNaturalist place on your list of available places, find it's ```place_id``` and add it to ```places.json```. ```place_id``` can be found by searching for your place in the web-version of iNaturalist, and viewing the embeddable widget. The number in the URL for the widget is the ```place_id```.


## Fetching data

Once you've set your places, fetch data by running ```safari-json-build.py```. This script will create a ```JSON``` file, called ```inat-safari.json```, with all verifiable observations from each place. These observations will be grouped to remove duplicates and merge together observation pictures.

```safari-json-build.py``` should work without any additional packages beyond what is reasonably expected in a base installation.

```sh
python safari-json-build.py
```

```safari-json-build.py``` is designed to fetch observations filtered for the current and prior month-of-year. That means you should re-run it at on a monthly basis to keep it current to what people should actually be able to observe at this time of year.


## Running the webpage

For the web page to run properly, you need 3 files to be posted in in the same folder:

  1. ```inat-safari.json```
  1. ```safari.html```
  1. ```safari.js```
  
Those pages must then be hosted by a web server. Viewing the web page locally, using the ```file://``` protocol will run into security issues in most modern browsers.


## Using the web page

The web page will show you 4 iNaturalist observations from the selected place. It will show you three native plants and 1 non-native plant (whether introduced or endemic).

Each plant will be shown in a tile, which provides the user available observation pictures, a link to the iNaturalist taxa page (with more information) and the Wikipedia (if known to the iNaturalist database). These are intended to help people identify the plant in the wild.

To get a new group of four plants, simply refresh the page.

### Selecting a place

The web page has 3 modes:

  1. ```Multiple place mode```
  1. ```Single place mode (file)```
  1. ```Single place mode (URL)```

#### Multiple place mode

In ```multiple place mode``` multiple places are defined in ```places.json``` and the user must first select the place of interest from a drop-down box.

#### Single place mode (file)

In ```single place mode (file)``` only one place is defined in ```places.json``` so no selection is required by the user.

#### Single place mode (URL)

In ```single place mode (URL)``` multiple places __can__ be defined in ```places.json``` but a place selected by a URL parameter is shown without the option to change places. 

To access this mode, access it through one of the other two modes and follow the link at the bottom of the page.