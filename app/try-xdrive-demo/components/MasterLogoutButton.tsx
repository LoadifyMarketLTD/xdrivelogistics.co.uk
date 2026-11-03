"use client";
import {LogOut} from "lucide-react";
import {useAuth} from "../../components/AuthContext";
export default function MasterLogoutButton(){
 const {logout}=useAuth();
 return <button type="button" className="xd-master-logout" onClick={()=>{void logout()}} aria-label="Log out" title="Log out"><LogOut size={17} aria-hidden="true"/><span>Log out</span></button>;
}
