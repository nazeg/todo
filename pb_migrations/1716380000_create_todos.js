migrate((app) => {
  const collection = new Collection({
    name: "todos",
    type: "base",
  });

  // PocketBase v0.23+ (fields) ve eski sürümler (schema) için uyumluluk kontrolü
  if (typeof TextField !== 'undefined') {
    collection.fields.add(new TextField({
      name: "title",
      required: true,
    }));
    collection.fields.add(new BoolField({
      name: "completed",
    }));
  } else {
    collection.schema = [
      {
        name: "title",
        type: "text",
        required: true,
      },
      {
        name: "completed",
        type: "bool",
      }
    ];
  }

  collection.listRule = "";
  collection.viewRule = "";
  collection.createRule = "";
  collection.updateRule = "";
  collection.deleteRule = "";

  return app.save(collection);
}, (app) => {
  try {
    const collection = app.findCollectionByNameOrId("todos");
    return app.delete(collection);
  } catch (err) {
    // collection zaten silinmiş veya mevcut değil
  }
});
