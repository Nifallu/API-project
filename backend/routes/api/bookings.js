const express = require('express')
const { Sequelize} = require('sequelize');

const { Spot, Review, SpotImage, User, ReviewImage, Booking } = require('../../db/models');

const { check } = require('express-validator');
const { handleValidationErrors } = require('../../utils/validation');

const { requireAuth } = require('../../utils/auth');
const { route } = require('./session');

const router = express.Router();


//Get all of the Current User's Bookings
router.get('/current', requireAuth, async (req, res)=>{
    const bookings = await Booking.findAll({
        where: {
            userId: req.user.id
        },
        include: [
            {
                model: Spot,
                attributes: ['id', 'ownerId', 'id','ownerId', 'address', 'city', 'state', 'country', 'lat', 'lng', 'name',
                'price'],
                include: {
                    model: SpotImage,
                    attributes: ['url'],
                    as: 'previewImage',
                }
            }
        ]
    })
    // Edit the response format // is there an easier way to reorder everything? 
    const transformedBookings = bookings.map(booking => ({
        id: booking.id,
        spotId: booking.spotId,
        Spot: {
            id: booking.Spot.id,
            ownerId: booking.Spot.ownerId,
            address: booking.Spot.address,
            city: booking.Spot.city,
            state: booking.Spot.state,
            country: booking.Spot.country,
            lat: parseFloat(booking.Spot.lat),
            lng: parseFloat(booking.Spot.lng),
            name: booking.Spot.name,
            price: parseFloat(booking.Spot.price),
            previewImage: booking.Spot.previewImage.map(image => image.url).join(', ')
        },
        userId: booking.userId,
        startDate: booking.startDate,
        endDate: booking.endDate,
        createdAt: booking.createdAt,
        updatedAt: booking.updatedAt
    }));
  
    res.json({ Bookings: transformedBookings });
})

//Edit a Booking
const validateBooking = [
    check('startDate')
        .exists({ checkFalsy: true })
        .withMessage('startDate is required'),
    check('endDate')
        .exists({ checkFalsy: true })
        .custom((endDate, { req }) => {
            const startDate = req.body.startDate; 
            if (endDate <= startDate) {
                throw new Error('endDate cannot be on or before startDate');
            }
            return true;
        }),
    handleValidationErrors
];
router.put('/:bookingId', requireAuth, validateBooking, async (req,res)=> {
    const {startDate, endDate} = req.body;
    const bookingId = req.params.bookingId;
    const booking = await Booking.findByPk(bookingId);

    if(booking===null){
        const error = new Error("Booking couldn't be found")
        return res.status(404).json({
            message: error.message,
        });
    }

    const spotId = booking.spotId;

    if(booking.userId !== req.user.id){
        return res.status(403).json({
            message: "Forbidden"
        })
    }

    const currentDate = new Date();

    if(startDate <= currentDate){
        return res.status(403).json({
            message: "Past bookings can't be modified"
        })
    }

    const checkStartDate = await Booking.findOne({
        where:{
            spotId,
            [Sequelize.Op.or]:{
                startDate: startDate,
                endDate: startDate,
                [Sequelize.Op.and]: [
                    {
                        startDate: {
                            [Sequelize.Op.lt]: startDate,
                        },
                        endDate: {
                            [Sequelize.Op.gt]: startDate,
                        },
                    }   
                ]
            },
            id: {
                [Sequelize.Op.ne]: bookingId // Exclude the booking being updated
            }

        }
    })
    const checkStartOnEnd = await Booking.findOne({
        where: {
            endDate:startDate
        }
})
    const checkEndDate = await Booking.findOne({
        where:{
            spotId,
            [Sequelize.Op.or]:{
                startDate: endDate,
                endDate: endDate,
                [Sequelize.Op.and]: [
                    {
                        startDate: {
                            [Sequelize.Op.lt]: endDate,
                        },
                        endDate: {
                            [Sequelize.Op.gt]: endDate,
                        },
                    } 
                ]
            },
            id: {
                [Sequelize.Op.ne]: bookingId // Exclude the booking being updated
            }
        }
    })

    const checkBetween = await Booking.findOne({
        where:{
            [Sequelize.Op.or]: [
                {
                    [Sequelize.Op.and]: [
                        { startDate: { [Sequelize.Op.lt]: startDate } },
                        { endDate: { [Sequelize.Op.gt]: endDate } },
                    ],
                },
                {
                    startDate: {
                        [Sequelize.Op.between]: [startDate, endDate]
                    }
                },
                {
                    endDate: {
                        [Sequelize.Op.between]: [startDate, endDate]
                    }
                }
            ],
            id: {
                [Sequelize.Op.ne]: bookingId // Exclude the booking being updated
            }
        }
    })

    if(checkStartOnEnd ===null && checkStartDate === null && checkEndDate === null && checkBetween === null){
        booking.startDate = startDate,
        booking.endDate = endDate
    }else {
        if(checkStartDate){
            return res.status(403).json({
                message: 'Sorry, this spot is already booked for the specified dates',
                errors: {
                    "startDate": "Start date conflicts with an existing booking"
                }
        })
        }

        if(checkEndDate){
            return res.status(403).json({
                message: 'Sorry, this spot is already booked for the specified dates',
                errors: {
                    "endDate": "End date conflicts with an existing booking"
                }
            })
        }
        return res.status(403).json({
            message: 'Sorry, this spot is already booked for the specified dates',
        })
        }

    res.json(booking)
})

//delete a booking
router.delete('/:bookingId', requireAuth, async (req,res)=>{
    const booking = await Booking.findByPk(req.params.bookingId)

    if(booking === null){
        const error = new Error("Booking couldn't be found")
        return res.status(404).json({
            message: error.message,
        });
    }

    if(booking.userId !== req.user.id){
        return res.status(403).json({
            message: "Forbidden"
        })
    }

    const currentDate = new Date()
    // currentDate.setHours(0, 0, 0, 0);
    const bookingStartDate = booking.startDate;
    // bookingStartDate.setHours(0, 0, 0, 0);
    
    if(bookingStartDate <= currentDate){
        return res.status(403).json({
            message:  "Bookings that have been started can't be deleted"
        })
    }

    await booking.destroy()

    res.json({
        "message": "Successfully deleted"
    })

})

module.exports = router;
