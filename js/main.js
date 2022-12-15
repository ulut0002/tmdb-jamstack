import { NetworkError, delay, WebError } from "./utils.js";

//Utility functions
const UTILITY = {
  // internal
  addParamToURL: function (target, value) {
    if (!value) return target;
    return target + APP.URL_SEPARATOR + encodeURIComponent(value);
  },

  // returns image path for both posters and cast members
  createImagePath: function (posterPath = "", size = "w500") {
    if (!posterPath) return "./images/image not found.png";
    return `https://image.tmdb.org/t/p/${size}/${posterPath}`;
  },

  // generates a url like this: index.html#/tv/keyword/4
  generateIndexURL: function (selectedFilter, keywordText, page) {
    //example:  index.html#/tv|movie/keyword/1|2|3
    if (!page) page = 1;
    if (!keywordText) keywordText = "";
    return (
      `index.html#` +
      APP.URL_SEPARATOR +
      selectedFilter +
      APP.URL_SEPARATOR +
      encodeURIComponent(keywordText) +
      APP.URL_SEPARATOR +
      page
    );
  },
  // generates a url like this: credits.html#/movie/[ID]/credits/movie_title
  generateCreditsURL: function (movieObj) {
    let urlBase = `./credits.html#`;
    if (!movieObj) return urlBase;

    urlBase =
      urlBase +
      APP.URL_SEPARATOR +
      movieObj._type +
      APP.URL_SEPARATOR +
      movieObj.id +
      APP.URL_SEPARATOR +
      encodeURIComponent(movieObj._searchTerm) +
      APP.URL_SEPARATOR +
      encodeURIComponent(movieObj._title);
    return urlBase;
  },

  // called for credits page. Cast members are sorted by popularity (desc)
  sortCastArrByPopularity(arr) {
    if (!arr) return arr;
    arr.sort((a, b) => {
      if (!a.popularity) return 1;
      if (!b.popularity) return -1;
      if (a.popularity === b.popularity) return 0;
      return a.popularity < b.popularity ? 1 : -1;
    });
    return arr;
  },
};

const APP = {
  URL_SEPARATOR: "/",
  POSTER_SIZE: "w500",
  PROFILE_SIZE: "w185",
  PAGINATION_SIZE: 5,
  SHOW_DESCRIPTION_MAX_SIZE: 250,
  init: function () {
    //init PAGE object, read  DOM variables and register events
    PAGE.init();

    window.addEventListener("popstate", PAGE.popHandler);

    if (!location.hash) {
      history.replaceState({}, null, `${PAGE.CURRENT.shortURL}#`);
      DOM.selectTV.checked = DOM.selectTV;
      DOM.setInnerHTML(DOM.messageContainer, PAGE.MESSAGES.WELCOME);
    } else {
      //if the page has hash, then fire the search right away.
      //if it is a bad search, it will display an error
      //if it is a good search, then what is searched will depend on which page the user is on.
      PAGE.firePopSearch();
    }
  },
};

// A search can be triggered by: form submit, direct page access, popHandler or pagination,
// SEARCH_PARAMS object will hold the parameters for all triggers
// SEARCH object uses SEARCH_PARAMS object as source
const SEARCH_PARAMS = {
  searchMovie: false,
  searchTV: false,
  searchMovieCredit: false,
  searchTVCredit: false,
  keyword: "",
  requestedPage: 1,
  movieShowID: 0,

  init: function () {
    SEARCH_PARAMS.searchTVCredit = false;
    SEARCH_PARAMS.searchMovieCredit = false;
    SEARCH_PARAMS.searchTV = false;
    SEARCH_PARAMS.searchMovie = false;
    SEARCH_PARAMS.keyword = "";
    SEARCH_PARAMS.requestedPage = 1;
    SEARCH_PARAMS.movieShowID = 0;
  },
  isMovieSearch: function () {
    return SEARCH_PARAMS.searchMovie || SEARCH_PARAMS.searchTV;
  },
  isCreditSearch: function () {
    return SEARCH_PARAMS.searchTVCredit || SEARCH_PARAMS.searchMovieCredit;
  },
};

// SEARCH object is a stand-alone object
// it uses SEARCH_PARAMS to conduct the search, and then
// uses "callback" object to call success and fail functions.
// call "execute" only after setting the "params" and "callback" variables
const SEARCH = {
  api: {
    key: `012e36aa22f85eee73b43fe2627eb4e1`,
    baseURL: "https://api.themoviedb.org",
    movieSearchURL: "/3/search/movie",
    tvSearchURL: "/3/search/tv",
    movieCreditsURL: "/3/movie/[ID]/credits",
    tvCreditsURL: "/3/tv/[ID]/credits",
  },

  // .success and .fail are functions
  // both must be assigned before calling the fetch function.
  callback: {
    success: undefined,
    fail: undefined,
  },

  init: function () {
    SEARCH.callback.fail = undefined;
    SEARCH.callback.success = undefined;
  },

  // cleans dom-containers, execute the search and calls callback.success or callback.fail
  execute: function () {
    DOM.cleanContainers();

    if (PAGE.isMainPage() && SEARCH_PARAMS.isMovieSearch()) {
      SEARCH_PARAMS.keyword
        ? SEARCH.performShowSearch()
        : DOM.setInnerHTML(DOM.messageContainer, PAGE.MESSAGES.ENTER_MOVIE);
    } else if (PAGE.isCreditsPage() && SEARCH_PARAMS.isCreditSearch()) {
      SEARCH_PARAMS.movieShowID
        ? SEARCH.performCreditSearch()
        : DOM.setInnerHTML(DOM.errorContainer, PAGE.MESSAGES.MOVIE_ID_MISSING);
    } else {
      // This should not happen (ideally)
      DOM.setInnerHTML(DOM.errorContainer, PAGE.MESSAGES.UNEXPECTED_ERROR_1);
    }
  },

  getIdentifier: function () {
    if (SEARCH_PARAMS.searchMovie || SEARCH_PARAMS.searchMovieCredit)
      return "movie";
    if (SEARCH_PARAMS.searchTV || SEARCH_PARAMS.searchTVCredit) return "tv";
  },
  // fixes requested page. If the conditions fail, it returns "1" by default
  getRequestedPage: function (val) {
    const page = parseInt(val);
    if (!page || page <= 0 || page > 1000) return 1;
    return page;
  },
  // calls fetch function with a specific url and url-search-params for movie/show details
  performShowSearch: function () {
    PAGE.readPageURL();
    const page = SEARCH.getRequestedPage(SEARCH_PARAMS.requestedPage);
    const completeURL =
      SEARCH.api.baseURL +
      (SEARCH_PARAMS.searchMovie
        ? SEARCH.api.movieSearchURL
        : SEARCH.api.tvSearchURL);
    let url = new URL(completeURL);
    url.searchParams.append("page", page);
    url.searchParams.append("query", SEARCH_PARAMS.keyword);
    url.searchParams.append("api_key", SEARCH.api.key);
    SEARCH.doFetch(url);
  },
  // calls fetch function with a specific url and url-search-params for cast members
  performCreditSearch: function () {
    let completeURL =
      SEARCH.api.baseURL +
      (SEARCH_PARAMS.searchMovieCredit
        ? SEARCH.api.movieCreditsURL
        : SEARCH.api.tvCreditsURL);
    completeURL = completeURL.replace("[ID]", SEARCH_PARAMS.movieShowID);

    let url = new URL(completeURL);
    url.searchParams.append("api_key", SEARCH.api.key);
    SEARCH.doFetch(url);
  },
  // called by both credit and movie search.
  // success and fail functions are set externally..
  doFetch: function (url) {
    fetch(url)
      .then((response) => {
        if (!response.ok) throw new NetworkError("Bad Request", response);
        return response.json();
      })
      .then((data) => {
        if (SEARCH.callback.success) {
          SEARCH.callback.success(data);
        } else {
          DOM.setInnerHTML(DOM.errorContainer, PAGE.MESSAGES.NO_RESULT_FOUND);
        }
      })
      .catch((err) => {
        if (SEARCH.callback.fail) {
          SEARCH.callback.fail(err);
        } else {
          DOM.setInnerHTML(
            DOM.errorContainer,
            PAGE.MESSAGES.UNEXPECTED_ERROR_1
          );
        }
      });
  },
};

// DOM stores all DOM elements on the page.
// Both index.html and credits.html have similar or same elements.
// DOM elements must have data-jamstack attribute. such as data-jamstack="error" represents error container.

const DOM = {
  body: undefined,
  resultContainer: undefined,
  errorContainer: undefined,
  messageContainer: undefined,
  pageContainer: undefined,
  selectTV: undefined,
  selectMovie: undefined,
  inputText: undefined,
  form: undefined,
  ATTRIBUTE: "data-jamstack",

  init: function () {
    // read all the dom elements
    DOM.body = document.querySelector("body");

    // data-jamstack="result-header"
    DOM.resultContainer = DOM.getElement(DOM.createSelector("result-header"));

    // data-jamstack="error"
    DOM.errorContainer = DOM.getElement(DOM.createSelector("error"));

    // data-jamstack="message"
    DOM.messageContainer = DOM.getElement(DOM.createSelector("message"));

    // data-jamstack="form"
    DOM.form = DOM.getElement(DOM.createSelector("form"));

    // data-jamstack="search-tv"
    DOM.selectTV = DOM.getElement(DOM.createSelector("search-tv"));

    // data-jamstack="search-movie"
    DOM.selectMovie = DOM.getElement(DOM.createSelector("search-movie"));

    // data-jamstack="search-input"
    DOM.inputText = DOM.getElement(DOM.createSelector("search-input"));

    // there are two pagination elements
    DOM.pageContainer = DOM.getElements(DOM.createSelector("pagination"));
    if (DOM.pageContainer) {
      DOM.pageContainer.forEach((pageContainer) => {
        pageContainer.addEventListener("click", PAGE.handleNavigation);
      });
    }

    // add event listeners
    if (DOM.form) DOM.form.addEventListener("submit", PAGE.handleFormSubmit);

    if (DOM.selectTV)
      DOM.selectTV.addEventListener("change", PAGE.handleRadioSelection);

    if (DOM.selectMovie)
      DOM.selectMovie.addEventListener("change", PAGE.handleRadioSelection);

    DOM.cleanContainers();
  },

  // sets each message/error/result container content to blank before each search trigger.
  cleanContainers: function () {
    DOM.setInnerHTML(DOM.resultContainer, "");
    DOM.setInnerHTML(DOM.errorContainer, "");
    DOM.setInnerHTML(DOM.messageContainer, "");
    DOM.setArrInnerHTML(DOM.pageContainer, "");
  },
  // functions below are utility functions.
  createSelector(val) {
    return `[${DOM.ATTRIBUTE} = ${val}]`;
  },
  getElement(selector) {
    return document.querySelector(selector);
  },
  getElements(selector) {
    return document.querySelectorAll(selector);
  },
  setInnerHTML: function (element, value) {
    if (!element) return;
    if (!value) value = "";
    element.innerHTML = value;
  },
  setArrInnerHTML: function (element, value) {
    if (!element) return;
    if (!value) value = "";
    element.forEach((el) => (el.innerHTML = value));
  },
};

// PAGE object represents the current loaded page

const PAGE = {
  // CURRENT represents current page values.
  // The values can be set from the URL or from the search triggers.
  CURRENT: {
    pageId: undefined, //main|credits
    shortURL: undefined, //index.html | credits.html
    pageNumber: undefined, //from the api
    totalPages: undefined, //from the api
    totalResults: undefined, //from the api
    isMainPage: undefined,
    isCreditsPage: undefined,
    urlType: undefined, //tv|movie
    urlKeyword: undefined, //user keyword
    showID: undefined,
    showName: undefined,
  },
  MESSAGES: {
    WELCOME: `<h2 class="welcome--message font-h1">Welcome to JamStack!</h2>
    <h3 class="welcome--message font-h5">Search movies and tv-shows fast!</h3>`,
    ENTER_MOVIE: `<h2 class="clean--margin">Enter a show or movie name</h2>`,
    MOVIE_ID_MISSING: `<h2 class="clean--margin">Invalid request. Movie ID is missing!</h2>`,
    UNEXPECTED_ERROR_1: `<h2 class="clean--margin">An unexpected error happened!</h2>`,
    NO_RESULT_FOUND: `<h2 class="clean--margin">No result found</h2>`,
    MOVIE_OVERVIEW_NA: "Overview Not Available",
    RATING_NA: "Rating N/A",
    NOT_AVAILABLE: "N/A",
    FIRST_AIR_DATE_NA: "First airdate N/A",
    RELEASE_DATE_NA: "Release date N/A",
    NO_CAST_FOUND: "<h2>No cast member found</h2>",
  },

  init: function () {
    //read all dom elements and register events
    DOM.init();

    //figure out which page we are on and read the url values
    if (DOM.body && DOM.body.hasAttribute("id")) {
      const id = DOM.body.attributes
        .getNamedItem("id")
        .textContent.toString()
        .toLowerCase();

      PAGE.CURRENT.pageId = id;
      PAGE.CURRENT.isMainPage = id === "main";
      PAGE.CURRENT.isCreditsPage = id === "credits";
      PAGE.CURRENT.shortURL = PAGE.CURRENT.isMainPage
        ? "index.html"
        : "credits.html";

      PAGE.readPageURL();
    } else {
      //error out because something is wrong with the page
      DOM.setInnerHTML(DOM.errorContainer, PAGE.MESSAGES.UNEXPECTED_ERROR_1);
    }
  },

  isMainPage: function () {
    return PAGE.CURRENT.isMainPage;
  },
  isCreditsPage: function () {
    return PAGE.CURRENT.isCreditsPage;
  },
  readPageURL: function () {
    const url = PAGE.readURL(); // up to 4 parameters
    if (url) {
      if (PAGE.isMainPage()) {
        PAGE.CURRENT.urlType = url?.arg1 ? url.arg1 : "tv";
        PAGE.CURRENT.urlKeyword = url?.arg2 ? url.arg2 : "";
        PAGE.CURRENT.pageNumber = url?.arg3 ? url.arg3 : 1;
      } else if (PAGE.isCreditsPage()) {
        PAGE.CURRENT.urlType = url?.arg1 ? url.arg1 : "tv";
        PAGE.CURRENT.showID = url?.arg2 ? url.arg2 : "";
        PAGE.CURRENT.urlKeyword = url?.arg3 ? url.arg3 : "";
        PAGE.CURRENT.showName = url?.arg4 ? url.arg4 : "";
      }
    }
  },

  handleSearchEvent: function (target) {
    // can be triggered by:
    // 1. form-submit
    // 2. radio button selection within the form
    // this triggers a search, and then updates the hash

    if (!target) return;
    const formEl = target.closest("form");
    if (!formEl) return;
    if (!DOM.inputText) return;
    DOM.cleanContainers();

    const selectedFilterEl = formEl.querySelector("input[name=filter]:checked");
    if (!selectedFilterEl) return;
    const selectedFilter = selectedFilterEl.value.toString(); //movie / tv

    const keywordText = DOM.inputText.value.toString().trim();

    // If event is triggered on the 'credits' page,
    // then a URL is built, and the page is re-directed to index.html.
    if (PAGE.isCreditsPage()) {
      const url = UTILITY.generateIndexURL(selectedFilter, keywordText, 1);
      location.href = url;
      return;
    }

    // We are on main page.. Trigger the search for a tv show or a movie.
    SEARCH.init();
    SEARCH_PARAMS.searchTV = selectedFilter.includes("tv");
    SEARCH_PARAMS.searchMovie = selectedFilter.includes("movie");
    SEARCH_PARAMS.requestedPage = 1; //brand new searches always start from page 1
    SEARCH_PARAMS.keyword = keywordText;
    SEARCH.callback.success = PAGE.displayMovies;
    SEARCH.callback.fail = PAGE.displayError;
    PAGE.updatePageHash(PAGE.CURRENT.shortURL, selectedFilter, keywordText, 1);
    SEARCH.execute();
  },

  handleRadioSelection: function (ev) {
    ev.preventDefault();
    if (DOM.form && DOM.inputText.value.toString().trim() != "")
      PAGE.handleSearchEvent(ev.target);
  },
  handleFormSubmit: function (ev) {
    if (ev) ev.preventDefault();
    PAGE.handleSearchEvent(ev.target);
  },

  // This builds the pagination and dumps it into html (2 containers)
  buildPagination() {
    let html = "";
    let paginationSize = PAGE.getPaginationSize();

    const possiblePages = [];
    possiblePages[0] = PAGE.CURRENT.pageNumber - 2; //First
    possiblePages[1] = PAGE.CURRENT.pageNumber - 1; //Previous
    for (let index = 0; index < paginationSize; index++) {
      possiblePages.push(PAGE.CURRENT.pageNumber + index);
    }

    // Exclude bad entries and limit the number of pages to configured setting
    const pagesToDisplay = possiblePages
      .filter((item) => {
        if (item <= 0) return false;
        if (item > PAGE.CURRENT.totalPages) return false;
        return true;
      })
      .filter((_, index) => {
        return index < paginationSize;
      });

    const links = [];
    for (let index = 0; index < pagesToDisplay.length; index++) {
      //const element = array[index];
      links.push(
        UTILITY.generateIndexURL(
          PAGE.CURRENT.urlType,
          PAGE.CURRENT.urlKeyword,
          pagesToDisplay[index]
        )
      );
    }

    const attrGoTo = "jamstackGoTo";

    if (PAGE.CURRENT.pageNumber !== 1) {
      html =
        html +
        `<a class="btn btn-navigation" data-${attrGoTo}="${1}" href="${UTILITY.generateIndexURL(
          PAGE.CURRENT.urlType,
          PAGE.CURRENT.urlKeyword,
          1
        )}">First</a>`;

      html =
        html +
        `<a class="btn btn-navigation" data-${attrGoTo}="${Math.max(
          1,
          PAGE.CURRENT.pageNumber - 1
        )}" href="${UTILITY.generateIndexURL(
          PAGE.CURRENT.urlType,
          PAGE.CURRENT.urlKeyword,
          Math.max(1, PAGE.CURRENT.pageNumber - 1)
        )}">Prev</a>`;
    }

    for (let index = 0; index < pagesToDisplay.length; index++) {
      html =
        html +
        `<a class="btn btn-navigation btn-navigation__large ${
          pagesToDisplay[index] == PAGE.CURRENT.pageNumber
            ? "pagination-active"
            : ""
        }" href="${links[index]}" data-${attrGoTo}="${pagesToDisplay[index]}">${
          pagesToDisplay[index]
        }</a>`;
    }

    html =
      html +
      `<a class="btn btn-navigation" data-${attrGoTo}="${Math.min(
        PAGE.CURRENT.pageNumber + 1,
        PAGE.CURRENT.totalPages
      )}" href="${UTILITY.generateIndexURL(
        PAGE.CURRENT.urlType,
        PAGE.CURRENT.urlKeyword,
        Math.min(PAGE.CURRENT.pageNumber + 1, PAGE.CURRENT.totalPages)
      )}">Next</a>`;
    html =
      html +
      `<a class="btn btn-navigation" data-${attrGoTo}="${
        PAGE.CURRENT.totalPages
      }" href="${UTILITY.generateIndexURL(
        PAGE.CURRENT.urlType,
        PAGE.CURRENT.urlKeyword,
        PAGE.CURRENT.totalPages
      )}">Last</a>`;

    DOM.setArrInnerHTML(DOM.pageContainer, html);
  },
  // returns how many "page" buttons will show on the pagination container
  getPaginationSize: function () {
    const size = Number.parseInt(APP.PAGINATION_SIZE);
    if (!size || size <= 0 || size > 1000) return 5;
    return size;
  },
  // Called when pagination container is clicked.
  // In order to continue, and the target must be an "a" link and it must have a certain data attribute
  handleNavigation: function (ev) {
    ev.preventDefault();
    ev.stopPropagation();
    if (!ev.target) return;
    if (ev.target.tagName === "A") {
      if (ev.target.dataset.jamstackgoto) {
        let goTo = Number.parseInt(ev.target.dataset.jamstackgoto);
        goTo ? PAGE.navigateTo(goTo) : "";
      }
    }
  },
  // navigates to desired page and updates the hash
  navigateTo: function (page) {
    SEARCH_PARAMS.requestedPage = page;
    SEARCH.callback.success = PAGE.displayMovies;
    SEARCH.callback.fail = PAGE.displayError;
    PAGE.updatePageHash(
      PAGE.CURRENT.shortURL,
      PAGE.CURRENT.urlType,
      PAGE.CURRENT.urlKeyword,
      page
    );
    SEARCH.execute();
  },

  // called by fetch within the search function
  displayMovies: function (data) {
    let html = "";

    PAGE.CURRENT.pageNumber = data.page ? data.page : 1;
    PAGE.CURRENT.totalResults = data.total_results ? data.total_results : 1;
    PAGE.CURRENT.totalPages = data.total_pages ? data.total_pages : 1;

    //if there is data, built the pagination and data-grid
    if (data.results && data.results.length >= 1) {
      PAGE.buildPagination();

      html += data.results.map((show) => PAGE.showToHTML(show)).join("");
      html = `<ul class="show-container">${html}</ul>`;
      DOM.setInnerHTML(DOM.resultContainer, html);
    } else {
      html += PAGE.MESSAGES.NO_RESULT_FOUND;
      DOM.setInnerHTML(DOM.messageContainer, html);
    }
  },
  // create a card view for a show or movie
  showToHTML(show) {
    if (!show) return "";
    let html = "";
    const showTitle = SEARCH_PARAMS.searchTV ? show.name : show.title;
    const showType = SEARCH.getIdentifier(); //tv | show

    // custom properties added.. They are used in URL creation in another function
    show._type = showType;
    show._title = showTitle;
    show._searchTerm = SEARCH_PARAMS.keyword;
    let overview = show.overview
      ? show.overview
      : PAGE.MESSAGES.MOVIE_OVERVIEW_NA;

    //if the overview is too long, cut it short.
    if (overview.length > APP.SHOW_DESCRIPTION_MAX_SIZE)
      overview = overview.substr(0, APP.SHOW_DESCRIPTION_MAX_SIZE) + "...";

    const voteAverage = show.vote_average
      ? `${show.vote_average} / <small>10</small>`
      : PAGE.MESSAGES.RATING_NA;

    let firstAirDate = PAGE.MESSAGES.NOT_AVAILABLE;
    if (SEARCH_PARAMS.searchTV) {
      firstAirDate = show.first_air_date
        ? show.first_air_date
        : PAGE.MESSAGES.FIRST_AIR_DATE_NA;
    } else {
      firstAirDate = show.release_date
        ? show.release_date
        : PAGE.MESSAGES.RELEASE_DATE_NA;
    }

    html = `
    <li class="show-card shadow-1" data-id="${
      show.id
    }" data-type="${showType}">        
          <img class="show-image shadow-1" src="${UTILITY.createImagePath(
            show.poster_path,
            APP.POSTER_SIZE
          )}" alt="Feature poster of movie/tv show ${showTitle}"/>
        <h2 class="show-name">${showTitle}</h2>
        <p class="show-overview">${overview}</p>
        <p class="show-air-date">${firstAirDate}</p>
        <div class="show-rating">${voteAverage}</div>
        <div><a class="btn show-card-btn " href="${UTILITY.generateCreditsURL(
          show
        )}" aria-label="Click to view cast details of ${showTitle}">See Cast</a></div>
      </li>`;
    return html;
  },
  // create a card view for a show or movie
  creditsToHTML: function (data) {
    let html = "";
    const type = SEARCH.getIdentifier(); //tv | show

    if (Array.isArray(data)) {
      html += data
        .map((item) => {
          let popularity_class = "NA";
          if (item.popularity) {
            popularity_class = "high";
            if (item.popularity < 10) popularity_class = "low";
            else if (item.popularity < 30) popularity_class = "medium";
          }

          const txt = `<li class="credits-card shadow-1" data-id="${
            item.id
          }  data-type="${type}"">
             
          <img class="credit-image  shadow-1" src="${UTILITY.createImagePath(
            item?.profile_path,
            APP.PROFILE_SIZE
          )}" alt="${item.name} profile image"/>
          
          <h2 class="credit__name">${item.name}</h2>
          <p class="credit__character">${
            item.character ? `as ${item.character}` : " info N/A"
          }</p>
          <p class="credit__popularity">Popularity: <span class="credit__popularity__score
          credit__popularity__score--${popularity_class}">${
            item.popularity
          }<span></p>
          
          </li>`;
          return txt;
        })
        .join("");
    } else {
      html = PAGE.MESSAGES.NO_RESULT_FOUND;
    }
    return html;
  },

  displayCredits: function (data) {
    if (!data) return;

    // Cast is sorted by popularity, descending
    data.cast = UTILITY.sortCastArrByPopularity(data?.cast);

    let html = "";

    if (data.cast && data.cast.length >= 1) {
      if (PAGE.CURRENT.showName)
        html += `<h2 class="credits-show-name">${PAGE.CURRENT.showName}<h2>`;

      html += `<h2 class="credits-header">Cast members</h2>`;
      html += `<ul class="credit-container">`;
      html += PAGE.creditsToHTML(data.cast);
      html += `</ul>`;
      DOM.setInnerHTML(DOM.resultContainer, html);
    } else {
      DOM.setInnerHTML(DOM.messageContainer, PAGE.MESSAGES.NO_CAST_FOUND);
    }
  },

  displayError: function (err) {
    if (!err) return;

    DOM.setInnerHTML(DOM.errorContainer, "");

    let errorMessage = "";
    switch (err.name) {
      case "NetworkError":
        errorMessage = `Network Error.`;
        const errStatus = err.status ? err.status : "";
        const errStatusText = err.statusText ? err.statusText : "";
        const errMessage = err.message ? err.message : "";
        errorMessage = `Network Error ${errStatus} - ${errStatusText} ${errMessage}`;
        break;
      case "WebError":
        errorMessage = "Web failure. This should not have happened!";
        break;
      default:
        errorMessage = err.message ? err.message : `Error!`;
    }
    DOM.setInnerHTML(DOM.errorContainer, errorMessage);
  },

  // URLs can have up to 4 parameters.
  readURL: function () {
    let hash = location.hash;
    if (hash) {
      let [, arg1, arg2, arg3, arg4] = hash.split(APP.URL_SEPARATOR);
      arg1 = decodeURIComponent(arg1 ? arg1 : "");
      arg2 = decodeURIComponent(arg2 ? arg2 : "");
      arg3 = decodeURIComponent(arg3 ? arg3 : "");
      arg4 = decodeURIComponent(arg4 ? arg4 : "");
      return { arg1, arg2, arg3, arg4 };
    }
  },
  // @page: index.html or credits.html
  updatePageHash: function (page, p1, p2, p3, p4) {
    let pushURL = `${page}#`;
    pushURL = UTILITY.addParamToURL(pushURL, p1);
    pushURL = UTILITY.addParamToURL(pushURL, p2);
    pushURL = UTILITY.addParamToURL(pushURL, p3);
    pushURL = UTILITY.addParamToURL(pushURL, p4);
    history.pushState({}, "", pushURL);
  },
  popHandler: function (ev) {
    PAGE.firePopSearch();
  },
  firePopSearch: function () {
    // firePopSearch is triggered by: 1) popEvent  2) URL reload

    PAGE.readPageURL();

    SEARCH.init();
    if (PAGE.isMainPage()) {
      SEARCH_PARAMS.searchTV = PAGE.CURRENT.urlType.includes("tv");
      SEARCH_PARAMS.searchMovie = PAGE.CURRENT.urlType.includes("movie");
      if (!SEARCH_PARAMS.searchMovie && !SEARCH_PARAMS.searchTV)
        SEARCH_PARAMS.searchMovie = true;
      SEARCH_PARAMS.keyword = PAGE.CURRENT.urlKeyword
        ? PAGE.CURRENT.urlKeyword
        : "";

      SEARCH_PARAMS.requestedPage = SEARCH.getRequestedPage(
        PAGE.CURRENT.pageNumber
      );
      SEARCH.callback.success = PAGE.displayMovies;
    } else if (PAGE.isCreditsPage()) {
      SEARCH_PARAMS.searchTVCredit = PAGE.CURRENT.urlType.includes("tv");
      SEARCH_PARAMS.searchMovieCredit = PAGE.CURRENT.urlType.includes("movie");
      SEARCH_PARAMS.movieShowID = PAGE.CURRENT.showID;
      SEARCH_PARAMS.keyword = PAGE.CURRENT.urlKeyword
        ? PAGE.CURRENT.urlKeyword
        : "";
      SEARCH.callback.success = PAGE.displayCredits;
    }

    SEARCH.callback.fail = PAGE.displayError;

    //fill form values
    if (DOM.selectTV)
      DOM.selectTV.checked =
        SEARCH_PARAMS.searchTV || SEARCH_PARAMS.searchTVCredit;

    if (DOM.selectMovie)
      DOM.selectMovie.checked =
        SEARCH_PARAMS.searchMovie || SEARCH_PARAMS.searchMovieCredit;

    if (DOM.inputText) DOM.inputText.value = SEARCH_PARAMS.keyword;

    SEARCH.execute();
  },
};

document.addEventListener("DOMContentLoaded", APP.init);
