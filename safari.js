let allTaxa = [];
let places = [];

fetch("iNat-safari.json")
    .then(response => {
        if (!response.ok) {
            throw new Error("Could not load iNat-safari.json");
        }

        return response.json();
    })
    .then(data => {
        allTaxa = data.taxa.results;
        places = data.places.results;

        initializePage();
    })
    .catch(error => {
        console.error(error);

        document.getElementById("taxa").innerHTML =
            `<p>Error loading iNat-safari.json: ${error.message}</p>`;
    });


function displayPlaceLink(place) {

    const container =
        document.getElementById("place-link");

    const slug = createSlug(place.name);

    const url =
        `${window.location.pathname}?place=${slug}`;

    container.innerHTML = `
        <p>
            Direct link to this place:
            <a href="${url}">
                ${place.name}
            </a>
        </p>
    `;
}


function displayPlaceSubtitle(place) {
    const container = document.getElementById("place-subtitle");

    if (place) {
        const inaturalistPlaceUrl =
            `https://www.inaturalist.org/places/${place.id}`;

        container.innerHTML = `
            <h2>${place.name}</h2>
            <div class="place-link">
                <a href="${inaturalistPlaceUrl}"
                   target="_blank"
                   rel="noopener noreferrer">
                    View this place on iNaturalist
                </a>
            </div>
        `;
    } else {
        container.innerHTML = "";
    }
}

function initializePage() {

    const urlParams = new URLSearchParams(window.location.search);
    const requestedSlug = urlParams.get("place");

    /*
     * If a place slug was supplied in the URL,
     * use it and hide the dropdown.
     */
    if (requestedSlug) {

        const selectedPlace = places.find(place =>
            createSlug(place.name) === requestedSlug
        );

        if (selectedPlace) {

            hidePlaceSelector();

            displayTaxaForPlace(selectedPlace.id);
            displayPlaceLink(selectedPlace);
            displayPlaceSubtitle(selectedPlace);

            return;
        }

        // A slug was supplied but doesn't match a place.
        document.getElementById("taxa").innerHTML = `
            <p>
                Place "<strong>${requestedSlug}</strong>" was not found.
            </p>
        `;

        hidePlaceSelector();

        return;
    }


    /*
     * No URL slug.
     *
     * If there is only one place, hide the selector
     * and automatically display that place.
     */
    if (places.length === 1) {

        hidePlaceSelector();

        displayTaxaForPlace(places[0].id);
        displayPlaceLink(places[0]);
        displayPlaceSubtitle(places[0]);

        return;
    }


    /*
     * Multiple places and no URL slug:
     * show the dropdown.
     */
    populatePlaceDropdown(places);

    // Don't automatically show all taxa.
    // Select the first place by default.
    if (places.length > 0) {
        displayTaxaForPlace(places[0].id);
        document.getElementById("place-select").value =
            places[0].id;
        displayPlaceLink(places[0]);
        displayPlaceSubtitle(places[0]);
    }
}


/*
 * Convert a place name into a URL-friendly slug.
 *
 * Example:
 *
 * "Mt Tom~Easthampton/Holyoke"
 *
 * becomes:
 *
 * "mt-tom-easthampton-holyoke"
 */
function createSlug(name) {

    return name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}


/*
 * Hide both the label and dropdown.
 */
function hidePlaceSelector() {

    const select =
        document.getElementById("place-select");

    const label =
        document.querySelector('label[for="place-select"]');

    if (select) {
        select.style.display = "none";
    }

    if (label) {
        label.style.display = "none";
    }
}


/*
 * Populate the dropdown.
 *
 * Notice that there is intentionally NO
 * "All places" option.
 */
function populatePlaceDropdown(places) {

    const select =
        document.getElementById("place-select");

    places.forEach(place => {

        const option =
            document.createElement("option");

        option.value = place.id;
        option.textContent = place.name;

        select.appendChild(option);
    });


    select.addEventListener("change", () => {

        const selectedPlaceId =
            Number(select.value);

        const selectedPlace =
            places.find(place =>
                place.id === selectedPlaceId
            );

        displayTaxaForPlace(selectedPlaceId);
        displayPlaceLink(selectedPlace);
        displayPlaceSubtitle(selectedPlace);
    });
}


/*
 * Filter taxa by place_id.
 */
function displayTaxaForPlace(placeId) {

    const filteredTaxa =
        allTaxa.filter(result =>
            result.place_ids &&
            result.place_ids.includes(placeId)
        );

    displayRandomTaxa(filteredTaxa);
}


/*
 * Select 3 native and 1 non-native taxon.
 */
function displayRandomTaxa(results) {

    const nativeTaxa =
        results.filter(result =>
            result.taxon.native === true
        );

    const nonNativeTaxa =
        results.filter(result =>
            result.taxon.native === false
        );


    /*
     * Make sure there are enough results.
     */
    if (
        nativeTaxa.length < 3 ||
        nonNativeTaxa.length < 1
    ) {

        document.getElementById("taxa").innerHTML = `
            <p>
                Not enough taxa are available for this place
                to show 3 native and 1 non-native species.
            </p>
        `;

        return;
    }


    const selectedNative =
        getRandomItems(nativeTaxa, 3);

    const selectedNonNative =
        getRandomItems(nonNativeTaxa, 1);


    const selectedTaxa = [
        ...selectedNative,
        ...selectedNonNative
    ];


    displayTaxa(selectedTaxa);
}


/*
 * Pick random items without modifying
 * the original array.
 */
function getRandomItems(array, number) {

    const shuffled = [...array]
        .sort(() => Math.random() - 0.5);

    return shuffled.slice(0, number);
}


/*
 * Build the taxon cards.
 */
function displayTaxa(results) {

    const container =
        document.getElementById("taxa");

    container.innerHTML = "";


    results.forEach(result => {

        const taxon = result.taxon;

        const inaturalistUrl =
            `https://www.inaturalist.org/taxa/${taxon.id}`;


        let photosHTML = "";


        if (
            result.photos &&
            result.photos.length > 0
        ) {

            photosHTML = result.photos
                .map(photo => {

                    return `
                        <div class="photo">

                            <a
                                href="${photo.url}"
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                <img
                                    src="${photo.url}"
                                    alt="${taxon.preferred_common_name || taxon.name}"
                                >
                            </a>

                            <div class="attribution">

                                <a
                                    href="${photo.url}"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    ${photo.attribution}
                                </a>

                            </div>

                        </div>
                    `;
                })
                .join("");
        }


        const card =
            document.createElement("div");

        card.className = "taxon-card";


        card.innerHTML = `

            <h2>
                ${taxon.preferred_common_name || "Unknown"}
            </h2>

            <div class="scientific-name">
                <i>${taxon.name}</i>
            </div>

            <div class="native-status">
                ${taxon.native ? "Native" : "Non-native"}
            </div>

            <div class="resources">

                <h3>Identification resources</h3>

                <ul>

                    <li>
                        <a
                            href="${inaturalistUrl}"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            iNaturalist
                        </a>
                    </li>

                    ${
                        taxon.wikipedia_url
                        ? `
                            <li>
                                <a
                                    href="${taxon.wikipedia_url}"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    Wikipedia
                                </a>
                            </li>
                          `
                        : ""
                    }

                </ul>

            </div>

            ${
                photosHTML
                ? `
                    <div class="photos">

                        <h3>Photos</h3>

                        <div class="photo-grid">
                            ${photosHTML}
                        </div>

                    </div>
                  `
                : ""
            }

        `;


        container.appendChild(card);
    });
}