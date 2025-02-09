const { Product } = require('../models/product');
const express = require('express');
const { Category } = require('../models/category');
const router = express.Router();
const mongoose = require('mongoose');
const multer = require('multer');
const cloudinary = require('../cloudinary'); // Asegúrate de importar correctamente la configuración de Cloudinary
const buildHookUrl = "https://api.netlify.com/build_hooks/67a8d35f5c17bbf5381a1f2d";
let buildHookTimeout = null; // 👈 Declara aquí la variable

// Función debounce
const triggerDeploy = () => {
  clearTimeout(buildHookTimeout); // Ahora la variable está definida
  buildHookTimeout = setTimeout(() => {
    fetch(buildHookUrl, { method: 'POST' })
      .then(response => {
        if (response.ok) {
          console.log("✅ Deploy Netlify activado");
        }
      })
      .catch(error => console.error("Error:", error));
  }, 120000); // 5 minutos
};
const FILE_TYPE_MAP = {
    'image/png': 'png',
    'image/jpeg': 'jpeg',
    'image/jpg': 'jpg'
};

// Aseguramos que el tipo de archivo sea válido
const validateImageType = (file) => {
    return FILE_TYPE_MAP[file.mimetype];
};
    
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const isValid = validateImageType(file);
        let uploadError = new Error('Invalid image type');

        if (isValid) {
            uploadError = null;
        }

        cb(uploadError, 'public/uploads'); // Guarda la imagen localmente antes de subir a Cloudinary
    },
    filename: function (req, file, cb) {
        const fileName = file.originalname.split(' ').join('-');
        const extension = FILE_TYPE_MAP[file.mimetype];
        cb(null, `${fileName}-${Date.now()}.${extension}`); // Genera un nombre único para la imagen
    }
});

const uploadOptions = multer({ storage: storage });

router.get(`/`, async (req, res) =>{
    let filter = {};
    if(req.query.categories)
    {
         filter = {category: req.query.categories.split(',')}
    }

    const productList = await Product.find(filter).populate('category');

    if(!productList) {
        res.status(500).json({success: false})
    } 
    res.send(productList);
})

router.get(`/:id`, async (req, res) =>{
    const product = await Product.findById(req.params.id).populate('category');

    if(!product) {
        res.status(500).json({success: false})
    } 
    res.send(product);
})

router.post(`/`, uploadOptions.single('image'), async (req, res) => {
    const category = await Category.findById(req.body.category);
    if (!category) return res.status(400).send('Invalid Category');

    const file = req.file;  // Obtén el archivo de la solicitud
    if (!file) return res.status(400).send('No image in the request');

    // Subir la imagen a Cloudinary
    cloudinary.uploader.upload(file.path, {
        folder: 'products', // Carpeta donde se almacenarán las imágenes
        transformation: [
            { quality: 'auto', fetch_format: 'auto', width: 800, crop: 'limit' } // Optimización
        ]
    }, async (error, result) => {
        if (error) {
            return res.status(500).send('Error uploading image to Cloudinary');
        }

        const imageUrl = result.secure_url; // Obtén la URL segura de Cloudinary

        let product = new Product({
            name: req.body.name,
            description: req.body.description,
            richDescription: req.body.richDescription,
            image: imageUrl,  // Guarda la URL de la imagen en Cloudinary
            brand: req.body.brand,
            price: req.body.price,
            category: req.body.category,
            countInStock: req.body.countInStock,
            rating: req.body.rating,
            numReviews: req.body.numReviews,
            isFeatured: req.body.isFeatured,
        });

        product = await product.save();
        if (!product) return res.status(500).send('The product cannot be created');
        triggerDeploy();  // Reemplaza el await fetch(...)
        res.send(product);
    });
});

router.put('/:id', uploadOptions.single('image'), async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
        return res.status(400).send('Invalid Product Id');
    }

    const category = await Category.findById(req.body.category);
    if (!category) return res.status(400).send('Invalid Category');

    let imageUrl;

    // Si se envía una nueva imagen, súbela a Cloudinary
    if (req.file) {
        try {
            const uploadResult = await cloudinary.uploader.upload(req.file.path, {
                folder: 'products',
            });
            imageUrl = uploadResult.secure_url; // URL segura de Cloudinary
        } catch (error) {
            return res.status(500).send('Error uploading image to Cloudinary');
        }
    }

    const updatedData = {
        name: req.body.name,
        description: req.body.description,
        richDescription: req.body.richDescription,
        brand: req.body.brand,
        price: req.body.price,
        category: req.body.category,
        countInStock: req.body.countInStock,
        rating: req.body.rating,
        numReviews: req.body.numReviews,
        isFeatured: req.body.isFeatured,
    };

    // Solo agrega la nueva imagen si fue subida
    if (imageUrl) {
        updatedData.image = imageUrl;
    }

    const product = await Product.findByIdAndUpdate(req.params.id, updatedData, { new: true });

    if (!product) {
        return res.status(500).send('The product cannot be updated');
    }
    triggerDeploy();  // Agrega esta línea
    res.send(product);
});


router.delete('/:id', (req, res)=>{
    Product.findByIdAndDelete(req.params.id).then(product =>{
        if(product) {
            triggerDeploy();  // Agrega aquí
            return res.status(200).json({success: true, message: 'the product is deleted!'})
        } else {
            return res.status(404).json({success: false , message: "product not found!"})
        }
    }).catch(err=>{
       return res.status(500).json({success: false, error: err}) 
    })
})

router.get(`/get/count`, async (req, res) =>{
    const productCount = await Product.countDocuments((count) => count)

    if(!productCount) {
        res.status(500).json({success: false})
    } 
    res.send({
        productCount: productCount
    });
})

router.get(`/get/featured/:count`, async (req, res) =>{
    const count = req.params.count ? req.params.count : 0
    const products = await Product.find({isFeatured: true}).limit(+count);

    if(!products) {
        res.status(500).json({success: false})
    } 
    res.send(products);
})

router.put(
    '/gallery-images/:id', 
    uploadOptions.array('images', 10), 
    async (req, res)=> {
        if(!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).send('Invalid Product Id')
         }
         const files = req.files
         let imagesPaths = [];
         const basePath = `${req.protocol}://${req.get('host')}/public/uploads/`;

         if(files) {
            files.map(file =>{
                imagesPaths.push(`${basePath}${file.filename}`);
            })
         }

         const product = await Product.findByIdAndUpdate(
            req.params.id,
            {
                images: imagesPaths
            },
            { new: true}
        )

        if(!product)
            return res.status(500).send('the gallery cannot be updated!')

        res.send(product);
    }
)

module.exports =router;