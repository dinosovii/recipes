const api = "https://www.themealdb.com/api/json/v1/1";
const commonFoods = ["chicken", "eggs", "rice", "potatoes", "onion", "garlic", "tomato", "carrot", "milk", "cheese", "bread", "pasta"];

let foods = [], selected = [], recipes = [];

const recipeBox = new bootstrap.Modal(document.getElementById("recipebox"));
const foodList = document.getElementById("foodlist");
const picked = document.getElementById("picked");
const recipesDiv = document.getElementById("recipes");

function clean(text) {
    return text.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
}

function titleCase(text) {
    return text.replace(/\b[a-z]/g, letter => letter.toUpperCase());
}

async function getData(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error("Request failed");
    return response.json();
}

async function loadFoods() {
    try {
        const data = await getData(api + "/list.php?i=list");
        const names = (data.meals || []).map(item => item.strIngredient).filter(Boolean);
        foods = [
            ...commonFoods.map(name => names.find(item => clean(item) === name)).filter(Boolean),
            ...names.filter(name => !commonFoods.includes(clean(name))).sort()
        ];
        showFoods();
    } catch {
        foodList.textContent = "Couldn't load ingredients.";
    }
}

function showFoods() {
    const search = document.getElementById("search").value.toLowerCase();
    foodList.innerHTML = "";

    foods.filter(name => name.toLowerCase().includes(search)).slice(0, 12).forEach(name => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "food" + (selected.some(item => clean(item) === clean(name)) ? " on" : "");
        button.textContent = (button.classList.contains("on") ? "✓ " : "+ ") + titleCase(name);
        button.onclick = () => toggleFood(name);
        foodList.appendChild(button);
    });
}

function toggleFood(name) {
    selected = selected.some(item => clean(item) === clean(name))
        ? selected.filter(item => clean(item) !== clean(name))
        : [...selected, name];

    showFoods();
    showSelected();
}

function showSelected() {
    document.getElementById("count").textContent = selected.length;
    picked.innerHTML = selected.length ? "" : "Nothing picked yet";

    selected.forEach(name => {
        const tag = document.createElement("span");
        tag.className = "pick";
        tag.append(titleCase(name));

        const remove = document.createElement("button");
        remove.type = "button";
        remove.textContent = "×";
        remove.onclick = () => toggleFood(name);

        tag.appendChild(remove);
        picked.appendChild(tag);
    });
}

function getIngredients(meal) {
    return Array.from({ length: 20 }, (_, i) => ({
        name: (meal["strIngredient" + (i + 1)] || "").trim(),
        amount: (meal["strMeasure" + (i + 1)] || "").trim()
    })).filter(item => item.name);
}

function getMatch(meal) {
    const ingredients = getIngredients(meal);
    const have = ingredients.filter(item => selected.some(name => clean(name) === clean(item.name)));
    return { ingredients, have, missing: ingredients.filter(item => !have.includes(item)) };
}

async function findRecipes() {
    if (!selected.length) {
        return;
    }

    const button = document.getElementById("find");
    button.disabled = true;
    button.textContent = "Finding recipes...";
    recipesDiv.innerHTML = "";

    try {
        const results = await Promise.all(selected.map(name =>
            getData(api + "/filter.php?i=" + encodeURIComponent(name.toLowerCase().replace(/\s+/g, "_")))
        ));

        const meals = new Map();
        results.forEach(data => (data.meals || []).forEach(meal => meals.set(meal.idMeal, meal)));

        const details = await Promise.all([...meals.values()].slice(0, 18).map(async meal => {
            try {
                const data = await getData(api + "/lookup.php?i=" + meal.idMeal);
                return data.meals?.[0] || null;
            } catch {
                return null;
            }
        }));

        recipes = details.filter(Boolean).sort((a, b) => {
            const first = getMatch(a), second = getMatch(b);
            return second.have.length / second.ingredients.length -
                   first.have.length / first.ingredients.length;
        });

        showRecipes();
    } catch {
        recipesDiv.innerHTML = "<p>Couldn't load recipes.</p>";
    } finally {
        button.disabled = false;
        button.textContent = "Find recipes ↗";
    }
}

function showRecipes() {
    recipesDiv.innerHTML = "";

    if (!recipes.length) {
        recipesDiv.innerHTML = "<p>No recipes found.</p>";
        return;
    }

    recipes.forEach(meal => {
        const match = getMatch(meal);
        const column = document.createElement("div");
        column.className = "col-12 col-sm-6 col-xl-4";

        const card = document.createElement("article");
        card.className = "recipe";

        const image = document.createElement("img");
        image.className = "foodpic";
        image.src = meal.strMealThumb;
        image.alt = meal.strMeal;
        image.loading = "lazy";

        const body = document.createElement("div");
        body.className = "recipebody";

        const name = document.createElement("h3");
        name.className = "recipename";
        name.textContent = meal.strMeal;

        const count = document.createElement("p");
        count.className = "match";
        count.textContent = match.have.length + " of " + match.ingredients.length + " ingredients match";

        const missing = document.createElement("p");
        missing.className = "missing";
        missing.textContent = match.missing.length
            ? "Still need: " + match.missing.slice(0, 3).map(item => item.name).join(", ")
            : "You've got everything!";

        const view = document.createElement("button");
        view.className = "btn view-btn";
        view.type = "button";
        view.textContent = "Recipe details ↗";
        view.onclick = () => openRecipe(meal);

        body.append(name, count, missing, view);
        card.append(image, body);
        column.appendChild(card);
        recipesDiv.appendChild(column);
    });
}

function addRecipeLink(container, url, label, className) {
    if (!url) return;

    const link = document.createElement("a");
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.className = className;
    link.textContent = label;
    container.appendChild(link);
}

async function openRecipe(meal) {
    document.getElementById("recipetitle").textContent = meal.strMeal;
    const info = document.getElementById("recipeinfo");
    info.textContent = "Loading...";
    recipeBox.show();

    try {
        const data = await getData(api + "/lookup.php?i=" + meal.idMeal);
        const full = data.meals?.[0] || meal;
        info.innerHTML = "";

        const image = document.createElement("img");
        image.src = full.strMealThumb;
        image.alt = full.strMeal;
        image.className = "foodbig";
        info.appendChild(image);

        const grid = document.createElement("div");
        grid.className = "detail-grid";

        const ingredientsBox = document.createElement("section");
        ingredientsBox.innerHTML = '<h3 class="detail-title">Ingredients</h3>';

        getIngredients(full).forEach(item => {
            const line = document.createElement("div");
            line.className = "oneingredient";

            if (selected.some(name => clean(name) === clean(item.name))) line.classList.add("have");

            const name = document.createElement("span");
            name.className = "ingredient-name";
            name.textContent = item.name;

            const amount = document.createElement("span");
            amount.className = "ingredient-amount";
            amount.textContent = item.amount;

            line.append(name, amount);
            ingredientsBox.appendChild(line);
        });

        const instructionsBox = document.createElement("section");
        instructionsBox.innerHTML = '<h3 class="detail-title">How to make it</h3>';

        const instructions = document.createElement("p");
        instructions.className = "instructions";
        instructions.textContent = full.strInstructions || "No instructions available.";

        instructionsBox.append(instructions);
        grid.append(ingredientsBox, instructionsBox);
        info.appendChild(grid);

        const links = document.createElement("div");
        links.className = "recipe-links";
        addRecipeLink(links, full.strSource, "Original recipe ↗", "source-link");
        addRecipeLink(links, full.strYoutube, "YouTube video ▶", "video-link");

        if (links.children.length) info.appendChild(links);
    } catch {
        info.textContent = "Couldn't load recipe.";
    }
}

document.getElementById("search").addEventListener("input", showFoods);
document.getElementById("find").addEventListener("click", findRecipes);

showSelected();
loadFoods();