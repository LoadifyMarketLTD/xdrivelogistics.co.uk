package co.uk.xdrivelogistics.driver.nativepreview.data

import co.uk.xdrivelogistics.driver.nativepreview.model.*
import org.json.JSONArray
import org.json.JSONObject

class DriverRepository(private val api:XDriveApi) {
    suspend fun quotes(): Result<List<NativeQuote>> = parse(api.getQuotes()) { root ->
        val a=root.optJSONArray("bids")?:JSONArray(); buildList { for(i in 0 until a.length()){ val x=a.optJSONObject(i)?:continue; add(NativeQuote(x.optString("id"),x.optString("jobId"),x.optString("pickupLocation","Collection area"),x.optString("deliveryLocation","Delivery area"),x.num("amount"),x.optString("currency","GBP"),x.optString("status","submitted"),x.str("createdAt"),if(x.has("collectWithinMinutes")&&!x.isNull("collectWithinMinutes")) x.optInt("collectWithinMinutes") else null)) } }
    }
    suspend fun bookings(scope:String="active"): Result<List<NativeBooking>> = parse(api.getBookings(scope)) { root ->
        val a=root.optJSONArray("jobs")?:JSONArray(); buildList { for(i in 0 until a.length()){ val x=a.optJSONObject(i)?:continue; val id=x.optString("id"); add(NativeBooking(id, x.optString("reference").ifBlank { if(id.length>=8) "XDL-"+id.take(8).uppercase() else id }, x.first("pickupLocation","pickup_location","pickupPostcode","pickup_postcode","Collection"), x.first("deliveryLocation","delivery_location","deliveryPostcode","delivery_postcode","Delivery"), x.first("currentStatus","current_status","status","allocated"), x.str("companyName"),x.str("companyXdId"),x.num("price")?:x.num("agreedRateAmount"),x.optString("currency","GBP"),x.str("pickupDatetime")?:x.str("pickup_datetime"))) } }
    }
    suspend fun alerts(): Result<List<NativeAlert>> = parse(api.getResources()) { root ->
        val resources=root.optJSONObject("resources")?:JSONObject(); val a=resources.optJSONArray("alerts")?:JSONArray(); buildList { for(i in 0 until a.length()){ val x=a.optJSONObject(i)?:continue; val p=x.optJSONObject("payload")?:JSONObject(); val title=p.optString("title").ifBlank { x.optString("event_type","Activity").replace('_',' ') }; val body=p.optString("message").ifBlank { p.optString("body") }; add(NativeAlert(x.optString("id"),title,body,x.optString("event_type"),x.str("created_at"),x.optString("status")!="sent" && !p.has("read_at"))) } }
    }
    private suspend fun <T> parse(r:ApiResponse, mapper:(JSONObject)->T):Result<T>{ if(!r.successful) return Result.failure(IllegalStateException(runCatching{JSONObject(r.body).optString("error")}.getOrDefault("").ifBlank{"Request failed (${r.status})."})); return runCatching{mapper(JSONObject(r.body))} }
    private fun JSONObject.str(k:String)=if(has(k)&&!isNull(k)) optString(k).takeIf{it.isNotBlank()} else null
    private fun JSONObject.num(k:String):Double?=if(has(k)&&!isNull(k)) optDouble(k,Double.NaN).takeIf{it.isFinite()} else null
    private fun JSONObject.first(vararg keys:String):String { for(k in keys.dropLast(1)){ val v=optString(k); if(v.isNotBlank()) return v }; return keys.last() }
}
