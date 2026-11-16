export function dailyInputStatus(data,today){
 const empty={Sleep:false,HRV:false,Cycle:false,Weather:false,Photo:false};
 if(!data?.entry || data.entry.entry_date!==today)return empty;
 const check=data.entry.check_in||{};
 const finite=value=>typeof value==='number'&&Number.isFinite(value);
 return {
  Sleep:(finite(check.sleepHours)&&check.sleepHours>=0&&check.sleepHours<=24)||['Poor','Okay','Rested'].includes(check.sleepQuality),
  HRV:finite(check.hrvMs)&&check.hrvMs>0&&check.hrvMs<=500,
  Cycle:(finite(check.cycleDay)&&check.cycleDay>=1&&check.cycleDay<=120)||['Follicular','Ovulatory','Luteal','Menstrual','Not tracking','Not applicable'].includes(check.cyclePhase),
  Weather:!!data.environment&&['temperatureF','humidity','uvIndex','usAqi','pm25','pm10','ozone'].some(key=>finite(data.environment[key])),
  Photo:!!data.photo?.photo?.id && data.photo.photo.daily_entry_id===data.entry.id,
 };
}
