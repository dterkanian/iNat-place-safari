import json
import time
from collections import defaultdict
from datetime import date

import requests


# ============================================================
# Configuration
# ============================================================

PLACES_FILE = "places.json"
OUTPUT_FILE = "inat-safari.json"

# Radius around each place center used for nearby observations.
RADIUS_KM = 30

# Number of weeks on either side of the current week that the
# Safari page should consider when determining seasonal
# likelihood.
SEASONAL_WINDOW_WEEKS = 3

OBSERVATIONS_PER_PAGE = 200

# Delay between successful API requests.
REQUEST_DELAY = 0.5

# Retry configuration for rate limiting / temporary errors.
SLEEP_DURATION_BASE = 2
MAX_RETRIES = 10

# Observation filters.
MAX_RANK = "complex"
ICONIC_TAXA = ["Plantae"]


# ============================================================
# iNaturalist API
# ============================================================

API_BASE = "https://api.inaturalist.org/v2"

session = requests.Session()


def api_get(url, params=None):
    """
    GET an iNaturalist API endpoint.

    Handles:
        - HTTP 429 rate limiting
        - temporary 5xx errors
        - network errors

    Retries with progressively longer delays.
    """

    retry_count = 0
    sleep_multiplier = 1

    while True:

        try:
            response = session.get(
                url,
                params=params,
                timeout=60,
            )

        except requests.RequestException as exc:

            retry_count += 1

            if retry_count > MAX_RETRIES:
                raise RuntimeError(
                    f"Request failed after "
                    f"{MAX_RETRIES} retries: {exc}"
                ) from exc

            sleep_duration = (
                SLEEP_DURATION_BASE
                * sleep_multiplier
            )

            print(
                f"Request error: {exc}"
            )

            print(
                f"Retrying in "
                f"{sleep_duration} seconds..."
            )

            time.sleep(sleep_duration)

            sleep_multiplier += 1

            continue

        if response.status_code == 200:

            # Give the API a little breathing room even when
            # we aren't being rate limited.
            time.sleep(REQUEST_DELAY)

            return response.json()

        # ----------------------------------------------------
        # Rate limited
        # ----------------------------------------------------

        if response.status_code == 429:

            retry_count += 1

            if retry_count > MAX_RETRIES:
                raise RuntimeError(
                    f"Rate limited after "
                    f"{MAX_RETRIES} retries: {url}"
                )

            retry_after = response.headers.get(
                "Retry-After"
            )

            if retry_after:

                sleep_duration = int(
                    retry_after
                )

            else:

                sleep_duration = (
                    SLEEP_DURATION_BASE
                    * sleep_multiplier
                )

            print(
                f"Rate limited. "
                f"Retrying in "
                f"{sleep_duration} seconds..."
            )

            time.sleep(sleep_duration)

            sleep_multiplier += 1

            continue

        # ----------------------------------------------------
        # Temporary server errors
        # ----------------------------------------------------

        if response.status_code in (
            500,
            502,
            503,
            504,
        ):

            retry_count += 1

            if retry_count > MAX_RETRIES:
                raise RuntimeError(
                    f"Server error "
                    f"{response.status_code} "
                    f"after {MAX_RETRIES} retries: "
                    f"{url}"
                )

            sleep_duration = (
                SLEEP_DURATION_BASE
                * sleep_multiplier
            )

            print(
                f"Server returned "
                f"{response.status_code}. "
                f"Retrying in "
                f"{sleep_duration} seconds..."
            )

            time.sleep(sleep_duration)

            sleep_multiplier += 1

            continue

        # ----------------------------------------------------
        # Other errors
        # ----------------------------------------------------

        raise RuntimeError(
            f"iNaturalist API error "
            f"{response.status_code}: "
            f"{response.text}"
        )


# ============================================================
# Utility functions
# ============================================================

def upsize_photo_url(url, size="medium"):
    """
    Convert an iNaturalist square photo URL to a larger size.
    """

    if not url:
        return url

    return url.replace(
        "square",
        size,
    )


def get_place_center(place):
    """
    Calculate the center of a place's bounding box.

    The iNaturalist place geometry is GeoJSON.

    We calculate the center of the bounding box from the
    minimum/maximum longitude and latitude rather than using
    one corner of the geometry.
    """

    geometry = place.get(
        "bounding_box_geojson"
    )

    if not geometry:
        return None

    coordinates = geometry.get(
        "coordinates"
    )

    if not coordinates:
        return None

    try:

        # First linear ring of the bounding box.
        ring = coordinates[0]

        longitudes = [
            point[0]
            for point in ring
        ]

        latitudes = [
            point[1]
            for point in ring
        ]

        center_longitude = (
            min(longitudes)
            + max(longitudes)
        ) / 2

        center_latitude = (
            min(latitudes)
            + max(latitudes)
        ) / 2

        return {
            "longitude": center_longitude,
            "latitude": center_latitude,
        }

    except (
        IndexError,
        TypeError,
        KeyError,
    ):

        return None


# ============================================================
# Load place IDs
# ============================================================

with open(
    PLACES_FILE,
    "r",
    encoding="utf-8",
) as file:

    place_id_list = json.load(file)


if not isinstance(
    place_id_list,
    list,
):

    raise ValueError(
        f"{PLACES_FILE} must contain "
        f"a JSON array of place IDs."
    )


place_id_list = [
    int(x)
    for x in place_id_list
]


print(
    f"Loaded {len(place_id_list)} place IDs."
)


place_id_csv = ",".join(
    str(x)
    for x in place_id_list
)


# ============================================================
# Fetch place metadata
# ============================================================

print()
print("Fetching place information...")


place_data = api_get(
    f"{API_BASE}/places/{place_id_csv}",
    params={
        "fields": (
            "id,"
            "name,"
            "bounding_box_geojson"
        )
    },
)


places = {}


for place in place_data.get(
    "results",
    [],
):

    place_id = place["id"]

    center = get_place_center(
        place
    )

    places[place_id] = {
        "id": place_id,
        "name": place.get("name"),
        "center": center,
    }


print(
    f"Retrieved {len(places)} places."
)


# ============================================================
# Fetch observations
# ============================================================

print()
print("Fetching observations...")


observation_fields = (
    "place_ids,"
    "taxon.id,"
    "taxon.native,"
    "taxon.name,"
    "taxon.preferred_common_name,"
    "taxon.wikipedia_url,"
    "photos.attribution,"
    "photos.url"
)


iconic_taxa_csv = ",".join(
    ICONIC_TAXA
)


taxa = {}

page_num = 1


while True:

    print(
        f"Fetching observation page "
        f"{page_num}..."
    )

    data = api_get(
        f"{API_BASE}/observations",
        params={
            "per_page": OBSERVATIONS_PER_PAGE,
            "page": page_num,
            "verifiable": "true",
            "hrank": MAX_RANK,
            "place_id": place_id_csv,
            "iconic_taxa": iconic_taxa_csv,
            "fields": observation_fields,
        },
    )

    results = data.get(
        "results",
        [],
    )

    print(
        f"  Received {len(results)} "
        f"observations."
    )

    if not results:
        break

    for observation in results:

        taxon = observation.get(
            "taxon"
        )

        if not taxon:
            continue

        taxon_id = taxon.get(
            "id"
        )

        if taxon_id is None:
            continue

        observation_place_ids = (
            observation.get(
                "place_ids",
                []
            )
        )

        matching_place_ids = [
            place_id
            for place_id in place_id_list
            if place_id in observation_place_ids
        ]

        if not matching_place_ids:
            continue

        # ----------------------------------------------------
        # Create taxon
        # ----------------------------------------------------

        if taxon_id not in taxa:

            taxa[taxon_id] = {
                "count": 0,
                "taxon": taxon,
                "place_ids": [],
                "photos": [],
            }

        taxa_entry = taxa[taxon_id]

        taxa_entry["count"] += 1

        # ----------------------------------------------------
        # Associate taxon with places
        # ----------------------------------------------------

        for place_id in matching_place_ids:

            if (
                place_id
                not in taxa_entry["place_ids"]
            ):

                taxa_entry[
                    "place_ids"
                ].append(place_id)

        # ----------------------------------------------------
        # Photos
        # ----------------------------------------------------

        for photo in observation.get(
            "photos",
            [],
        ):

            photo_url = photo.get(
                "url"
            )

            if not photo_url:
                continue

            photo_entry = {
                **photo,
                "url": upsize_photo_url(
                    photo_url
                ),
            }

            if (
                photo_entry
                not in taxa_entry["photos"]
            ):

                taxa_entry[
                    "photos"
                ].append(
                    photo_entry
                )

    page_num += 1


print()
print(
    f"Found {len(taxa)} taxa."
)


# ============================================================
# Fetch seasonal histograms
# ============================================================

print()
print(
    "Fetching nearby-observation "
    "seasonal histograms..."
)

print(
    f"Radius: {RADIUS_KM} km"
)

print(
    f"Seasonal window: "
    f"+/- {SEASONAL_WINDOW_WEEKS} weeks"
)


# ------------------------------------------------------------
# Build the list of place/taxon combinations.
#
# A taxon may occur at multiple places, and each place needs
# its own histogram because the 30 km search area is centered
# independently on each place.
# ------------------------------------------------------------

histogram_requests = []


for taxon_id, taxon_data in taxa.items():

    for place_id in taxon_data[
        "place_ids"
    ]:

        place = places.get(
            place_id
        )

        if not place:
            continue

        center = place.get(
            "center"
        )

        if not center:

            print(
                f"WARNING: Cannot determine "
                f"center for place "
                f"{place_id}."
            )

            continue

        histogram_requests.append({
            "place_id": place_id,
            "taxon_id": taxon_id,
            "latitude": center[
                "latitude"
            ],
            "longitude": center[
                "longitude"
            ],
        })


print(
    f"Need "
    f"{len(histogram_requests)} "
    f"place/taxon histograms."
)


# ------------------------------------------------------------
# Store histograms as:
#
#     histograms[place_id][taxon_id]
#
# ------------------------------------------------------------

histograms = defaultdict(dict)


for request_number, request in enumerate(
    histogram_requests,
    start=1,
):

    place_id = request[
        "place_id"
    ]

    taxon_id = request[
        "taxon_id"
    ]

    latitude = request[
        "latitude"
    ]

    longitude = request[
        "longitude"
    ]

    place_name = places[
        place_id
    ]["name"]

    taxon = taxa[
        taxon_id
    ]["taxon"]

    taxon_name = (
        taxon.get(
            "preferred_common_name"
        )
        or taxon.get(
            "name"
        )
    )

    print(
        f"[{request_number}/"
        f"{len(histogram_requests)}] "
        f"{place_name} / "
        f"{taxon_name}"
    )

    histogram_data = api_get(
        f"{API_BASE}/observations/histogram",
        params={
            "taxon_id": taxon_id,
            "lat": latitude,
            "lng": longitude,
            "radius": RADIUS_KM,
            "order": "desc",
            "order_by": "created_at",
            "fields": (
                "species_guess,"
                "observed_on,"
                "taxon_id"
            ),
            "date_field": "observed",
            "interval": "week_of_year",
        },
    )

    # --------------------------------------------------------
    # The histogram response has this structure:
    #
    # results:
    #   week_of_year:
    #       "1": 3
    #       "2": 0
    #       ...
    #
    # We preserve that dictionary directly.
    # --------------------------------------------------------

    results = histogram_data.get(
        "results",
        {}
    )

    week_counts = results.get(
        "week_of_year",
        {}
    )

    histograms[
        place_id
    ][
        taxon_id
    ] = {
        "radius_km": RADIUS_KM,

        "interval": "week_of_year",

        "seasonal_window_weeks":
            SEASONAL_WINDOW_WEEKS,

        "total_results":
            histogram_data.get(
                "total_results",
                0
            ),

        "counts": week_counts,
    }


# ============================================================
# Attach histograms to taxa
# ============================================================

print()
print("Attaching histograms to taxa...")


for taxon_id, taxon_data in taxa.items():

    taxon_data[
        "histograms"
    ] = {}

    for place_id in taxon_data[
        "place_ids"
    ]:

        histogram = (
            histograms
            .get(place_id, {})
            .get(taxon_id)
        )

        if histogram:

            taxon_data[
                "histograms"
            ][
                str(place_id)
            ] = histogram


# ============================================================
# Build final place list
# ============================================================

place_results = []


for place_id in place_id_list:

    place = places.get(
        place_id
    )

    if not place:
        continue

    place_results.append({
        "id": place["id"],
        "name": place["name"],
    })


# ============================================================
# Build final JSON
# ============================================================

safari_json = {
    "places": {
        "results": place_results
    },

    "taxa": {
        "results": list(
            taxa.values()
        )
    },

    "settings": {
        "radius_km": RADIUS_KM,
        "seasonal_window_weeks":
            SEASONAL_WINDOW_WEEKS,
        "histogram_interval":
            "week_of_year",
        "generated":
            date.today().isoformat(),
    },
}


# ============================================================
# Write output
# ============================================================

with open(
    OUTPUT_FILE,
    "w",
    encoding="utf-8",
) as file:

    json.dump(
        safari_json,
        file,
        indent=4,
        ensure_ascii=False,
    )


print()
print("=" * 60)
print(
    f"Safari data written to "
    f"{OUTPUT_FILE}"
)
print(
    f"Places: {len(place_results)}"
)
print(
    f"Taxa: {len(taxa)}"
)
print(
    f"Histograms: "
    f"{len(histogram_requests)}"
)
print("=" * 60)