migrate((app) => {
  const collection = new Collection({
    name: "todos",
    type: "base",
    schema: [
      {
        name: "title",
        type: "text",
        required: true,
      },
      {
        name: "completed",
        type: "bool",
      }
    ],
    listRule: "",
    viewRule: "",
    createRule: "",
    updateRule: "",
    deleteRule: "",
  });

  return app.save(collection);
}, (app) => {
  try {
    const collection = app.findCollectionByNameOrId("todos");
    return app.delete(collection);
  } catch (err) {
    // collection already deleted or doesn't exist
  }
});
