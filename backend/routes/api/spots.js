const express = require('express')
const { Model } = require('sequelize');

const { Spot, Review, SpotImage, User, ReviewImage } = require('../../db/models');

const { check } = require('express-validator');
const { handleValidationErrors } = require('../../utils/validation');

const { requireAuth } = require('../../utils/auth');
const { route } = require('./session');


const router = express.Router();


const validateSpot = [
    check('address')
      .exists({ checkFalsy: true })
      .withMessage('Street address is required'),
    check('city')
      .exists({ checkFalsy: true })
      .withMessage('City is required'),
    check('state')
      .exists({ checkFalsy: true })
      .withMessage('State is required'),
    check('country')
      .exists({ checkFalsy: true })
      .withMessage('Country is required'),
    check('lat')
      .exists({ checkFalsy: true })
      .isFloat({ min: -90, max: 90 })
      .withMessage('Latitude is not valid'),
    check('lng')
      .exists({ checkFalsy: true })
      .isFloat({ min: -180, max: 180 })
      .withMessage('Longitude is not valid'),
    check('name')
      .exists({ checkFalsy: true })
      .isLength({max: 50})
      .withMessage('Name must be less than 50 characters'),
    check('description')
      .exists({ checkFalsy: true })
      .withMessage('Description is required'),
    check('price')
      .exists({ checkFalsy: true })
      .isNumeric()
      .withMessage('Price per day is required'),

    handleValidationErrors
  ];

//get all Spots
router.get('/', async (req, res) => {
    const spots = await Spot.findAll({
    });
    const payload = [];
    for(let i = 0; i < spots.length; i++ ){
        const spot = spots[i];
        const previewImage = await SpotImage.findAll({
            where: {
                spotId: spot.id
            },
            attributes: ['url']
        })
        const count = await Review.count({
            where: {
                spotId: spot.id
            }
        })
        const sum = await Review.sum('stars', {
            where: {
                spotId: spot.id
            }
        })
        const avgRating = sum/count;

        const spotsData = {
            id: spot.id, 
            ownerId: spot.ownerId, 
            address: spot.address, 
            city: spot.city,
            state: spot.state, 
            country: spot.country, 
            lat: spot.lat, 
            lng: spot.lng, 
            name: spot.name, 
            description: spot.description, 
            price: spot.price,
            createdAt: spot.createdAt,
            updatedAt: spot.updatedAt, 
            previewImage: previewImage.map(image => image.url).join(', '),
            avgRating: avgRating
        };
        payload.push(spotsData)
    }
        return res.json(payload)
})

//Get all Spots owned by the current user
router.get('/current', requireAuth, async (req, res)=>{
    const userSpots = await Spot.findAll({
        where: {
            ownerId: req.user.id
        }
    })
    const Spots = [];
    for(let i = 0; i < userSpots.length; i++ ){
        const spot = userSpots[i];
        const previewImage = await SpotImage.findAll({
            where: {
                spotId: spot.id
            },
            attributes: ['url']
        })
        const count = await Review.count({
            where: {
                spotId: spot.id
            }
        })
        const sum = await Review.sum('stars', {
            where: {
                spotId: spot.id
            }
        })
        const avgRating = sum/count;

        const spotsData = {
            id: spot.id, 
            ownerId: spot.ownerId, 
            address: spot.address, 
            city: spot.city,
            state: spot.state, 
            country: spot.country, 
            lat: spot.lat, 
            lng: spot.lng, 
            name: spot.name, 
            description: spot.description, 
            price: spot.price,
            createdAt: spot.createdAt,
            updatedAt: spot.updatedAt, 
            previewImage: previewImage.map(image => image.url).join(', '),
            avgRating: avgRating
        };
        Spots.push(spotsData)
    }
        return res.json({Spots})
})

//add an Image to a Spot based on the spots id
router.post('/:spotId/images', requireAuth, async (req, res)=> {
    const spot = await Spot.findByPk(req.params.spotId)

    if(spot===null){
        res.status(404).json({
            message: "Spot couldn't be found"
        });
    }

    if(spot.ownerId !== req.user.id){
        return res.status(403).json({
            message: "Forbidden"
        })
    }

    const {url, preview} = req.body
    const newSpotImage = SpotImage.build({
        spotId: req.params.spotId,
        url,
        preview
    })

    await newSpotImage.save()

    res.json({       
        spotId: newSpotImage.spotId,
        url: newSpotImage.url,
        preview: newSpotImage.preview
    })
})

//Get details for a Spot from an id
router.get('/:spotId', async(req, res) =>{
    const spot = await Spot.findByPk(req.params.spotId)

    if(spot===null){
        const error = new Error("Spot couldn't be found")
        res.status(404).json({
            message: error.message,
        });
    }
    const numReviews = await Review.count({
        where:{
            spotId: spot.id
        } 
    })
    const sum = await Review.sum('stars', {
        where: {
            spotId: spot.id
        }
    })
    const avgRating = sum/numReviews;
    
    const SpotImages = await SpotImage.findAll({
        where: {
            spotId: spot.id
        },
        attributes: ['id', 'url', 'preview']
    })
    const Owner = await User.findOne({
        where: {
            id: spot.ownerId
        },
        attributes: ['id', 'firstName', 'lastName']
    })

    res.json({
        spot,
        numReviews,
        avgRating,
        SpotImages,
        Owner

    })
} )

//Get all Reviews by a Spot's id
router.get('/:spotId/reviews', async (req, res)=>{

    const spot = await Spot.findByPk(req.params.spotId)

    if(spot===null){
        const error = new Error("Spot couldn't be found")
        res.status(404).json({
            message: error.message,
        });
    }
    
    const reviews = await Review.findAll({
        where:{
        spotId: req.params.spotId
        },
        include:[ {
            model: User,
            attributes: ['id', 'firstName', 'lastName'],
        },
        {    
            model: ReviewImage,
            attributes: ['url']
        } 
        ]       
    })
    res.json({
        reviews
    })
})

//Create a Review for a Spot based on the Spot's id
const validateReview = [
    check('review')
        .exists({ checkFalsy: true })
        .withMessage('Review text is required'),
    check('stars')
        .exists({ checkFalsy: true })
        .isInt({min:1, max:5})
        .withMessage('Stars must be an integer from 1 to 5'),
    handleValidationErrors
];
router.post('/:spotId/reviews', requireAuth, validateReview, async (req, res)=>{
    const spot = await Spot.findByPk(req.params.spotId)

    if(spot===null){
        res.status(404).json({
            message: "Spot couldn't be found"
        });
    }

    const reviews = await Review.findAll({
        where:{
        userId: req.user.id,
        spotId: req.params.spotId
        }
    }) 
    if(reviews.length >= 1 ){
        res.status(403).json({
            message: "User already has a review for this spot"
        });
    }
    const {review, stars} = req.body
    const newReview = Review.build({
        userId: req.user.id,
        spotId: req.params.spotId,
        review,
        stars
    })
    await newReview.save()

    res.json(newReview)
})

  //Create a spot
router.post('/', requireAuth, validateSpot,  async (req, res)=>{
    const {address, city, state, country, lat, lng, name, description, price} = req.body
    const spotInfo = {}
    spotInfo.ownerId = req.user.id;
        spotInfo.address = address
        spotInfo.city = city
        spotInfo.state = state
        spotInfo.country = country
        spotInfo.lat = lat
        spotInfo.lng = lng
        spotInfo.name = name
        spotInfo.description = description
        spotInfo.price = price 
    
    const newSpot = Spot.build(
        spotInfo
    )
    await newSpot.save()

    res.json({
       newSpot
    })
})

//edit a spot
router.put('/:spotId', requireAuth, validateSpot, async (req, res)=>{
    const {address, city, state, country, lat, lng, name, description, price} = req.body;

    const spot = await Spot.findByPk(req.params.spotId)

    if(spot===null){
        const error = new Error("Spot couldn't be found")
        res.status(404).json({
            message: error.message,
        });
    }

    if(spot.ownerId !== req.user.id){
        return res.status(403).json({
            message: "Forbidden"
        })
    }

    if(address) spot.address = address;
    if(city) spot.city = city;
    if(state) spot.state = state;
    if(country) spot.country = country;
    if(lat) spot.lat = lat;
    if(lng) spot.lng = lng;
    if(name) spot.name = name;
    if(description) spot.description = description;
    if(price) spot.price = price;

    res.json(spot)
})

//delete a spot
router.delete('/:spotId', requireAuth, async (req, res)=>{

    const spot = await Spot.findByPk(req.params.spotId)

    if(spot===null){
        const error = new Error("Spot couldn't be found")
        res.status(404).json({
            message: error.message,
        });
    }

    if(spot.ownerId !== req.user.id){
        return res.status(403).json({
            message: "Forbidden"
        })
    }

    await spot.destroy();
    
    res.json({
        message: "Successfully deleted"
    })
})



module.exports = router;
