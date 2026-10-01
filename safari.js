let allTaxa = [];
let places = [];


// ============================================================
// Load safari data
// ============================================================

fetch("inat-safari.json")
    .then(response => {
        if (!response.ok) {
            throw new Error("Could not load inat-safari.json");
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
            `<p>Error loading inat-safari.json: ${error.message}</p>`;
    });


// ============================================================
// Place link
// ============================================================

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


// ============================================================
// Place subtitle
// ============================================================

function displayPlaceSubtitle(place) {

    const container =
        document.getElementById("place-subtitle");

    if (place) {

        const inaturalistPlaceUrl =
            `https://www.inaturalist.org/places/${place.id}`;

        container.innerHTML = `
            <h2>${place.name}</h2>

            <div class="place-link">
                <a
                    href="${inaturalistPlaceUrl}"
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    View this place on iNaturalist
                </a>
            </div>
        `;

    } else {

        container.innerHTML = "";
    }
}


// ============================================================
// Initialize page
// ============================================================

function initializePage() {

    const urlParams =
        new URLSearchParams(
            window.location.search
        );

    const requestedSlug =
        urlParams.get("place");


    /*
     * If a place slug was supplied in the URL,
     * use it and hide the dropdown.
     */

    if (requestedSlug) {

        const selectedPlace =
            places.find(place =>
                createSlug(place.name) === requestedSlug
            );


        if (selectedPlace) {

            hidePlaceSelector();

            displayTaxaForPlace(
                selectedPlace.id
            );

            displayPlaceLink(
                selectedPlace
            );

            displayPlaceSubtitle(
                selectedPlace
            );

            return;
        }


        // A slug was supplied but doesn't match a place.

        document.getElementById("taxa").innerHTML = `
            <p>
                Place "<strong>${requestedSlug}</strong>"
                was not found.
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

        displayTaxaForPlace(
            places[0].id
        );

        displayPlaceLink(
            places[0]
        );

        displayPlaceSubtitle(
            places[0]
        );

        return;
    }


    /*
     * Multiple places and no URL slug:
     * show the dropdown.
     */

    populatePlaceDropdown(
        places
    );


    // Select the first place by default.

    if (places.length > 0) {

        displayTaxaForPlace(
            places[0].id
        );

        document.getElementById(
            "place-select"
        ).value = places[0].id;

        displayPlaceLink(
            places[0]
        );

        displayPlaceSubtitle(
            places[0]
        );
    }
}


// ============================================================
// Create URL slug
// ============================================================

function createSlug(name) {

    return name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}


// ============================================================
// Hide place selector
// ============================================================

function hidePlaceSelector() {

    const select =
        document.getElementById(
            "place-select"
        );

    const label =
        document.querySelector(
            'label[for="place-select"]'
        );


    if (select) {
        select.style.display = "none";
    }

    if (label) {
        label.style.display = "none";
    }
}


// ============================================================
// Populate place dropdown
// ============================================================

function populatePlaceDropdown(
    places
) {

    const select =
        document.getElementById(
            "place-select"
        );


    places.forEach(place => {

        const option =
            document.createElement(
                "option"
            );

        option.value =
            place.id;

        option.textContent =
            place.name;

        select.appendChild(
            option
        );
    });


    select.addEventListener(
        "change",
        () => {

            const selectedPlaceId =
                Number(
                    select.value
                );

            const selectedPlace =
                places.find(
                    place =>
                        place.id ===
                        selectedPlaceId
                );


            displayTaxaForPlace(
                selectedPlaceId
            );

            displayPlaceLink(
                selectedPlace
            );

            displayPlaceSubtitle(
                selectedPlace
            );
        }
    );
}


// ============================================================
// Get current week of year
// ============================================================

function getWeekOfYear() {

    const date =
        new Date();

    const startOfYear =
        new Date(
            date.getFullYear(),
            0,
            1
        );


    const daysSinceStart =
        Math.floor(
            (
                date - startOfYear
            ) /
            (
                24 * 60 * 60 * 1000
            )
        );


    return Math.floor(
        daysSinceStart / 7
    ) + 1;
}


// ============================================================
// Get weeks surrounding the current week
// ============================================================
//
// The seasonal window is centered on the current week.
//
// For example, with a window of 3:
//
//     current week = 20
//
//     seasonal weeks =
//     17, 18, 19, 20, 21, 22, 23
//
// The calculation wraps around the beginning/end of
// the year.
//

function getSeasonalWeeks(
    currentWeek,
    windowSize
) {

    const weeks = [];

    const totalWeeks = 53;


    for (
        let offset = -windowSize;
        offset <= windowSize;
        offset++
    ) {

        let week =
            currentWeek + offset;


        if (week < 1) {
            week += totalWeeks;
        }

        if (week > totalWeeks) {
            week -= totalWeeks;
        }


        weeks.push(
            week
        );
    }


    return weeks;
}


// ============================================================
// Check whether a taxon is seasonally appropriate
// ============================================================
//
// Histogram structure:
//
// result.histograms[placeId] = {
//     radius_km: ...,
//     interval: "week_of_year",
//     seasonal_window_weeks: 3,
//     total_results: ...,
//     counts: {
//         "1": 10,
//         "2": 14,
//         ...
//     }
// }
//
// The histogram is used ONLY for selection.
// It is not displayed on the card.
//

function isSeasonallyAppropriate(
    result,
    placeId
) {

    if (
        !result.histograms
    ) {
        return false;
    }


    const histogram =
        result.histograms[
            String(placeId)
        ];


    if (
        !histogram ||
        !histogram.counts
    ) {
        return false;
    }


    const windowSize =
        Number(
            histogram.seasonal_window_weeks
        ) || 3;


    const currentWeek =
        getWeekOfYear();


    const seasonalWeeks =
        getSeasonalWeeks(
            currentWeek,
            windowSize
        );


    /*
     * Sum the observations occurring during
     * the current seasonal window.
     */

    let seasonalCount = 0;


    seasonalWeeks.forEach(
        week => {

            seasonalCount +=
                Number(
                    histogram.counts[
                        String(week)
                    ]
                ) || 0;
        }
    );


    return seasonalCount > 0;
}


// ============================================================
// Filter taxa by place and season
// ============================================================

function displayTaxaForPlace(
    placeId
) {

    /*
     * First filter by the selected place.
     *
     * This guarantees that nearby observations used
     * for the seasonal histogram cannot introduce
     * a plant that was not actually observed at the
     * selected place.
     */

    const placeTaxa =
        allTaxa.filter(
            result =>
                result.place_ids &&
                result.place_ids.includes(
                    placeId
                )
        );


    /*
     * Then use the histogram to determine which
     * of those place taxa are seasonally appropriate.
     */

    const seasonalTaxa =
        placeTaxa.filter(
            result =>
                isSeasonallyAppropriate(
                    result,
                    placeId
                )
        );


    displayRandomTaxa(
        seasonalTaxa
    );
}


// ============================================================
// Select 3 native and 1 non-native taxon
// ============================================================

function displayRandomTaxa(
    results
) {

    const nativeTaxa =
        results.filter(
            result =>
                result.taxon.native === true
        );


    const nonNativeTaxa =
        results.filter(
            result =>
                result.taxon.native === false
        );


    /*
     * Make sure there are enough results.
     */

    if (
        nativeTaxa.length < 1 &&
        nonNativeTaxa.length < 1
    ) {

        document.getElementById(
            "taxa"
        ).innerHTML = `
            <p>
                No seasonally appropriate taxa
                are available for this place.
            </p>
        `;

        return;
    }


    const selectedNative =
        getRandomItems(
            nativeTaxa,
            3
        );


    const selectedNonNative =
        getRandomItems(
            nonNativeTaxa,
            1
        );


    const selectedTaxa = [
        ...selectedNative,
        ...selectedNonNative
    ];


    displayTaxa(
        selectedTaxa
    );
}


// ============================================================
// Random selection
// ============================================================

function getRandomItems(
    array,
    number
) {

    const shuffled =
        [...array].sort(
            () => Math.random() - 0.5
        );

    return shuffled.slice(
        0,
        number
    );
}


// ============================================================
// Build taxon cards
// ============================================================

function displayTaxa(
    results
) {

    const container =
        document.getElementById(
            "taxa"
        );


    container.innerHTML = "";


    results.forEach(
        result => {

            const taxon =
                result.taxon;


            const inaturalistUrl =
                `https://www.inaturalist.org/taxa/${taxon.id}`;


            // ------------------------------------------------
            // Photos
            // ------------------------------------------------
            //
            // Only display the first six photos.
            //

            let photosHTML = "";


            if (
                result.photos &&
                result.photos.length > 0
            ) {

                const photos =
                    result.photos.slice(
                        0,
                        6
                    );


                photosHTML =
                    photos
                        .map(
                            photo => {

                                return `
                                    <div class="photo">

                                        <a
                                            href="${photo.url}"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                        >

                                            <img
                                                src="${photo.url}"
                                                alt="${
                                                    taxon.preferred_common_name ||
                                                    taxon.name
                                                }"
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
                            }
                        )
                        .join("");
            }


            // ------------------------------------------------
            // Card
            // ------------------------------------------------

            const card =
                document.createElement(
                    "div"
                );


            card.className =
                "taxon-card";


            card.innerHTML = `

                <h2>
                    ${
                        taxon.preferred_common_name ||
                        "Unknown"
                    }
                </h2>

                <div class="scientific-name">
                    <i>${taxon.name}</i>
                </div>

                <div class="native-status">
                    ${
                        taxon.native
                            ? "Native"
                            : "Non-native"
                    }
                </div>


                <div class="resources">

                    <h3>
                        Identification resources
                    </h3>

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

                                <h3>
                                    Photos
                                </h3>

                                <div class="photo-grid">
                                    ${photosHTML}
                                </div>

                            </div>
                        `
                        : ""
                }

            `;


            container.appendChild(
                card
            );
        }
    );
}


// ============================================================
// Instructions modal
// ============================================================

const helpButton =
    document.getElementById(
        "help-button"
    );


const instructionsModal =
    document.getElementById(
        "instructions-modal"
    );


const closeModal =
    document.getElementById(
        "close-modal"
    );


helpButton.addEventListener(
    "click",
    () => {

        instructionsModal.classList.add(
            "show"
        );

        instructionsModal.setAttribute(
            "aria-hidden",
            "false"
        );
    }
);


closeModal.addEventListener(
    "click",
    () => {

        instructionsModal.classList.remove(
            "show"
        );

        instructionsModal.setAttribute(
            "aria-hidden",
            "true"
        );
    }
);


// Close when clicking outside dialog.

instructionsModal.addEventListener(
    "click",
    event => {

        if (
            event.target ===
            instructionsModal
        ) {

            instructionsModal.classList.remove(
                "show"
            );

            instructionsModal.setAttribute(
                "aria-hidden",
                "true"
            );
        }
    }
);


// Close with Escape.

document.addEventListener(
    "keydown",
    event => {

        if (
            event.key === "Escape"
        ) {

            instructionsModal.classList.remove(
                "show"
            );

            instructionsModal.setAttribute(
                "aria-hidden",
                "true"
            );
        }
    }
);

