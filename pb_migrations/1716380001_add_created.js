migrate((app) => {
  try {
    const collection = app.findCollectionByNameOrId("todos");
    
    // Yalnızca yeni (v0.23+) versiyonlarında çalışsın
    if (typeof AutodateField !== 'undefined') {
      let changed = false;
      
      if (!collection.fields.getByName("created")) {
        collection.fields.add(new AutodateField({
          name: "created",
          onCreate: true,
          onUpdate: false,
        }));
        changed = true;
      }
      
      if (!collection.fields.getByName("updated")) {
        collection.fields.add(new AutodateField({
          name: "updated",
          onCreate: true,
          onUpdate: true,
        }));
        changed = true;
      }
      
      if (changed) {
        return app.save(collection);
      }
    }
  } catch (err) {
    // Koleksiyon bulunamazsa sessizce geç
  }
}, (app) => {
  try {
    const collection = app.findCollectionByNameOrId("todos");
    if (typeof AutodateField !== 'undefined') {
      collection.fields.removeByName("created");
      collection.fields.removeByName("updated");
      return app.save(collection);
    }
  } catch (err) {
    // Hata olursa sessizce geç
  }
});
