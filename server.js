const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, "data.json");

app.use(express.json());

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

function readPets() {
  try {
    const raw = fs.readFileSync(DATA_FILE, "utf8");
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === "ENOENT") return [];
    throw err;
  }
}

function writePets(pets) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(pets, null, 2) + "\n", "utf8");
}

function parseId(value) {
  return /^\d+$/.test(value) ? Number(value) : null;
}

function isNonEmptyString(v) {
  return typeof v === "string" && v.trim().length > 0;
}

app.get("/api/pets", (req, res) => {
  try {
    res.status(200).json(readPets());
  } catch (err) {
    res.status(500).json({ error: "Failed to read data file." });
  }
});

app.get("/api/pets/:id", (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) {
    return res.status(400).json({ error: "ID must be a positive whole number." });
  }
  try {
    const pet = readPets().find((p) => p.id === id);
    if (!pet) {
      return res.status(404).json({ error: `Pet with ID ${id} not found.` });
    }
    res.status(200).json(pet);
  } catch (err) {
    res.status(500).json({ error: "Failed to read data file." });
  }
});

app.post("/api/pets", (req, res) => {
  const { name, species, breed, age } = req.body || {};

  const errors = [];
  if (!isNonEmptyString(name)) errors.push("name is required.");
  if (!isNonEmptyString(species)) errors.push("species is required.");
  if (!isNonEmptyString(breed)) errors.push("breed is required.");

  const ageNum = typeof age === "string" && age.trim() !== "" ? Number(age) : age;
  if (typeof ageNum !== "number" || !Number.isFinite(ageNum) || ageNum < 0) {
    errors.push("age must be a number that is 0 or greater.");
  }

  if (errors.length > 0) {
    return res.status(400).json({ error: "Validation failed.", details: errors });
  }

  try {
    const pets = readPets();
    const nextId = pets.length > 0 ? Math.max(...pets.map((p) => p.id)) + 1 : 1;

    const newPet = {
      id: nextId,
      name: name.trim(),
      species: species.trim(),
      breed: breed.trim(),
      age: ageNum,
      adopted: false,
    };

    pets.push(newPet);
    writePets(pets);
    res.status(201).json(newPet);
  } catch (err) {
    res.status(500).json({ error: "Failed to write data file." });
  }
});

app.delete("/api/pets/:id", (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) {
    return res.status(400).json({ error: "ID must be a positive whole number." });
  }
  try {
    const pets = readPets();
    const index = pets.findIndex((p) => p.id === id);
    if (index === -1) {
      return res.status(404).json({ error: `Pet with ID ${id} not found.` });
    }
    if (pets[index].adopted) {
      return res.status(403).json({
        error: `Cannot delete ${pets[index].name} (ID ${id}): adopted pets cannot be deleted.`,
      });
    }
    const [removed] = pets.splice(index, 1);
    writePets(pets);
    res.status(200).json({ message: `Pet ${removed.name} (ID ${id}) deleted.`, pet: removed });
  } catch (err) {
    res.status(500).json({ error: "Failed to update data file." });
  }
});

app.use("/api", (req, res) => {
  res.status(404).json({ error: "Route not found." });
});

app.listen(PORT, () => {
  console.log(`Pet Adoption System running at http://localhost:${PORT}`);
});