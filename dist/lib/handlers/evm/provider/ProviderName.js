export var ProviderName;
(function (ProviderName) {
    ProviderName["INFURA"] = "INFURA";
    ProviderName["QUICKNODE"] = "QUICKNODE";
    ProviderName["FORNO"] = "FORNO";
    ProviderName["UNKNOWN"] = "UNKNOWN";
})(ProviderName || (ProviderName = {}));
export function deriveProviderName(url) {
    for (const name in ProviderName) {
        if (url.toUpperCase().includes(name)) {
            return ProviderName[name];
        }
    }
    return ProviderName.UNKNOWN;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiUHJvdmlkZXJOYW1lLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vbGliL2hhbmRsZXJzL2V2bS9wcm92aWRlci9Qcm92aWRlck5hbWUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsTUFBTSxDQUFOLElBQVksWUFLWDtBQUxELFdBQVksWUFBWTtJQUN0QixpQ0FBaUIsQ0FBQTtJQUNqQix1Q0FBdUIsQ0FBQTtJQUN2QiwrQkFBZSxDQUFBO0lBQ2YsbUNBQW1CLENBQUE7QUFDckIsQ0FBQyxFQUxXLFlBQVksS0FBWixZQUFZLFFBS3ZCO0FBRUQsTUFBTSxVQUFVLGtCQUFrQixDQUFDLEdBQVc7SUFDNUMsS0FBSyxNQUFNLElBQUksSUFBSSxZQUFZLEVBQUU7UUFDL0IsSUFBSSxHQUFHLENBQUMsV0FBVyxFQUFFLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxFQUFFO1lBQ3BDLE9BQU8sWUFBWSxDQUFDLElBQWlDLENBQUMsQ0FBQTtTQUN2RDtLQUNGO0lBRUQsT0FBTyxZQUFZLENBQUMsT0FBTyxDQUFBO0FBQzdCLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZW51bSBQcm92aWRlck5hbWUge1xuICBJTkZVUkEgPSAnSU5GVVJBJyxcbiAgUVVJQ0tOT0RFID0gJ1FVSUNLTk9ERScsXG4gIEZPUk5PID0gJ0ZPUk5PJyxcbiAgVU5LTk9XTiA9ICdVTktOT1dOJyxcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGRlcml2ZVByb3ZpZGVyTmFtZSh1cmw6IHN0cmluZyk6IFByb3ZpZGVyTmFtZSB7XG4gIGZvciAoY29uc3QgbmFtZSBpbiBQcm92aWRlck5hbWUpIHtcbiAgICBpZiAodXJsLnRvVXBwZXJDYXNlKCkuaW5jbHVkZXMobmFtZSkpIHtcbiAgICAgIHJldHVybiBQcm92aWRlck5hbWVbbmFtZSBhcyBrZXlvZiB0eXBlb2YgUHJvdmlkZXJOYW1lXVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiBQcm92aWRlck5hbWUuVU5LTk9XTlxufVxuIl19