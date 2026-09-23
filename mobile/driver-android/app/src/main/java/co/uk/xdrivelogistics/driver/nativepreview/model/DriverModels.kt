package co.uk.xdrivelogistics.driver.nativepreview.model

data class NativeQuote(val id:String,val jobId:String,val pickup:String,val delivery:String,val amount:Double?,val currency:String,val status:String,val createdAt:String?,val collectWithinMinutes:Int?)
data class NativeBooking(val id:String,val reference:String,val pickup:String,val delivery:String,val status:String,val companyName:String?,val memberId:String?,val price:Double?,val currency:String,val pickupAt:String?)
data class NativeAlert(val id:String,val title:String,val body:String,val type:String,val createdAt:String?,val unread:Boolean)
